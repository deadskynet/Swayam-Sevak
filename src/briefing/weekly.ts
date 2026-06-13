/**
 * Weekly review — accomplishments, meetings attended, suggested priorities.
 *
 * Composed from the past 7 daily logs and the workspace MEMORY.md.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { LLMProvider } from '../llm/types.js';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';
import { readWorkspaceMemory } from '../memory/long-term.js';
import { appendDailyLog } from '../memory/daily-log.js';

const SYSTEM = `You are composing the user's weekly review.

Output markdown with these sections (omit empty ones):
  - **Accomplishments** — what got done, with concrete refs to logs
  - **Meetings attended** — high-level patterns, not every event
  - **Notable correspondence** — only if surfaced in the logs
  - **Carry-over tasks** — explicit open items
  - **Suggested priorities for next week** — 3 max, grounded in the data

Be specific. Cite the log dates inline as (YYYY-MM-DD) when relevant.
Do not fabricate. If the logs are sparse, say so plainly.`;

export async function composeWeeklyReview(opts: {
  provider: LLMProvider;
  workspace: string;
}): Promise<string> {
  const files = (await readdir(paths.memoryDir).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, 7);

  const corpus: string[] = [];
  for (const f of files) {
    const md = await readText(join(paths.memoryDir, f), '');
    if (md.trim()) corpus.push(`# ${f}\n${md}`);
  }
  const memory = await readWorkspaceMemory(opts.workspace);
  const userMessage =
    `## Workspace MEMORY.md\n${memory.trim() || '(empty)'}\n\n` +
    `## Daily logs (most recent first)\n\n${corpus.join('\n\n---\n\n') || '(none)'}`;

  const r = await opts.provider.complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 1500,
    temperature: 0.4,
  });

  await appendDailyLog({
    ts: new Date(),
    source: 'weekly',
    workspace: opts.workspace,
    summary: 'Generated weekly review',
    details: r.text,
  });

  return r.text;
}
