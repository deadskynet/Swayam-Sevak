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
  console.log('Type your message; "/exit" to quit, "/trace" for last sources.');

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

    const result = await orchestrator.run({ history, userMessage: msg });
    process.stdout.write(result.reply + '\n');
    lastTrace = result.trace.sources;

    if (result.pendingConfirmations.length) {
      const approved = await askForConfirmations(rl, result.pendingConfirmations);
      if (approved.size) {
        const followUp = await orchestrator.run({
          history: result.history,
          userMessage: '(confirmed — please proceed)',
          approvedToolCallIds: approved,
        });
        process.stdout.write(followUp.reply + '\n');
        history = followUp.history;
        continue;
      }
    }
    history = result.history;
  }

  rl.close();
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
