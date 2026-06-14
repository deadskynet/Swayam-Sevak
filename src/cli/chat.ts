/**
 * Chat REPL and single-shot ask, on plain readline.
 *
 * Confirmation handling: when the orchestrator returns pending confirmations,
 * the REPL prints the requested tool and arguments, asks "y/N", and either
 * approves and re-runs, or drops the calls.
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { bootstrap } from './bootstrap.js';
import type { ChatMessage, ToolCallRequest } from '../llm/types.js';

export async function runChat(): Promise<void> {
  const { provider, orchestrator, workspace } = await bootstrap();

  console.log(`swayam-sevak [provider=${provider.name}] [workspace=${workspace}]`);
  console.log('Type your message; "/help" for commands.');

  const rl = createInterface({ input, output });
  let history: ChatMessage[] = [];
  let lastTrace: string[] = [];

  while (true) {
    let line: string;
    try {
      line = await rl.question('> ');
    } catch {
      break;
    }
    const msg = line.trim();
    if (!msg) continue;
    if (msg === '/exit' || msg === '/quit') break;
    if (msg === '/trace') {
      console.log(lastTrace.length ? lastTrace.join('\n') : '(no trace yet)');
      continue;
    }

    if (msg === '/help' || msg === '/?') {
      console.log(
        '/exit       quit the REPL\n' +
          '/trace      show the source files that fed the last reply\n' +
          '/help       show this help',
      );
      continue;
    }

    let result;
    try {
      result = await orchestrator.run({ history, userMessage: msg });
    } catch (err) {
      printFriendlyError(err);
      continue;
    }
    process.stdout.write(result.reply + '\n');
    lastTrace = result.trace.sources;

    if (result.pendingConfirmations.length) {
      const approved = await askForConfirmations(rl, result.pendingConfirmations);
      if (approved.size) {
        let followUp;
        try {
          followUp = await orchestrator.run({
            history: result.history,
            userMessage: '(confirmed — please proceed)',
            approvedToolCallIds: approved,
          });
        } catch (err) {
          printFriendlyError(err);
          continue;
        }
        process.stdout.write(followUp.reply + '\n');
        history = followUp.history;
        continue;
      }
    }
    history = result.history;
  }

  rl.close();
}

function printFriendlyError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // Common cases get a hint.
  let hint = '';
  if (/ANTHROPIC_API_KEY/.test(msg)) {
    hint = '\n   Hint: add ANTHROPIC_API_KEY to .env, or set SWAYAM_PROVIDER=echo to test offline.';
  } else if (/HF_TOKEN/.test(msg)) {
    hint = '\n   Hint: add HF_TOKEN to .env (https://huggingface.co/settings/tokens).';
  } else if (/HuggingFace 401|HuggingFace 403/.test(msg)) {
    hint = '\n   Hint: token is invalid or lacks Inference API access.';
  } else if (/HuggingFace 503/.test(msg)) {
    hint = '\n   Hint: HuggingFace model is loading; retry in ~30 seconds.';
  } else if (/anthropic.*overloaded|529/i.test(msg)) {
    hint = '\n   Hint: Anthropic is overloaded; try again shortly.';
  } else if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(msg)) {
    hint = '\n   Hint: network reachability issue. Check your connection.';
  }
  console.error(`\n✖ ${msg}${hint}\n`);
}

async function askForConfirmations(
  rl: ReturnType<typeof createInterface>,
  calls: ToolCallRequest[],
): Promise<Set<string>> {
  const approved = new Set<string>();
  for (const c of calls) {
    const ans = (
      await rl.question(
        `\n⚠️  Confirm ${c.name}(${JSON.stringify(c.arguments)})? [y/N] `,
      )
    )
      .trim()
      .toLowerCase();
    if (ans === 'y' || ans === 'yes') approved.add(c.id);
  }
  return approved;
}

export async function runAsk(message: string): Promise<void> {
  const { provider, orchestrator, workspace } = await bootstrap();
  console.error(`[provider=${provider.name}] [workspace=${workspace}]`);
  const result = await orchestrator.run({ userMessage: message });
  process.stdout.write(result.reply + '\n');
  if (result.pendingConfirmations.length) {
    console.error(
      `\n(skipped ${result.pendingConfirmations.length} confirmation-required tool calls; use \`swayam chat\` to approve)`,
    );
  }
}
