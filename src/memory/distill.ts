/**
 * Distill — fold recent daily logs into MEMORY.md.
 *
 * Reads the last N daily logs, asks the LLM to summarize them into durable
 * facts (preferences, project state, decisions, relationships), and appends
 * the result to the active workspace's MEMORY.md as a date-stamped section.
 *
 * The original daily logs are NEVER deleted — distillation is additive.
 * That preserves the audit trail.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';
import { appendWorkspaceMemory } from './long-term.js';
import type { LLMProvider } from '../llm/types.js';

const DISTILL_PROMPT = `You are reviewing the user's recent assistant interactions to extract durable
facts worth keeping in long-term memory.

Output a markdown bullet list. Each bullet should be:
  - a single durable fact, preference, decision, or relationship
  - phrased in the third person ("the user prefers...", "project Foo is...")
  - free of ephemeral chatter (no greetings, no one-off lookups)

If there is nothing worth keeping, output exactly: NOTHING_TO_DISTILL.`;

export async function distill(opts: {
  provider: LLMProvider;
  workspace: string;
  days?: number;
}): Promise<{ added: boolean; content: string }> {
  const days = opts.days ?? 7;

  const files = (await readdir(paths.memoryDir).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, days);

  if (files.length === 0) {
    return { added: false, content: 'No daily logs to distill.' };
  }

  const corpus: string[] = [];
  for (const f of files) {
    const md = await readText(join(paths.memoryDir, f), '');
    if (md.trim()) corpus.push(`# ${f}\n${md}`);
  }
  if (corpus.length === 0) {
    return { added: false, content: 'Daily logs are empty.' };
  }

  const result = await opts.provider.complete({
    system: DISTILL_PROMPT,
    messages: [{ role: 'user', content: corpus.join('\n\n---\n\n') }],
    maxTokens: 1024,
    temperature: 0.2,
  });

  const reply = result.text.trim();
  if (!reply || reply === 'NOTHING_TO_DISTILL') {
    return { added: false, content: 'Nothing worth distilling.' };
  }

  await appendWorkspaceMemory(opts.workspace, `Distillation of last ${days} days`, reply);
  return { added: true, content: reply };
}
