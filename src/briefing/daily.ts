/**
 * Daily briefing — composes today's summary using calendar, gmail, memory.
 *
 * The briefing is built by giving the LLM:
 *   - today's calendar events (via gog if available)
 *   - the most recent unread/important emails (best-effort via gog)
 *   - the active workspace's MEMORY.md
 *   - the previous day's daily log
 *
 * If gog is unavailable, the briefing degrades to memory + recent logs only,
 * with a clear note that calendar/email were skipped.
 */
import type { LLMProvider } from '../llm/types.js';
import { gogAvailable, gog, GogError } from '../integrations/gogcli.js';
import { readWorkspaceMemory } from '../memory/long-term.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';
import { appendDailyLog } from '../memory/daily-log.js';

const SYSTEM = `You are composing the user's daily briefing.

Output a tight markdown briefing with these sections (omit any section that has no content):
  - **Today's meetings** — bullet each event: time, title, attendees if relevant
  - **Important emails** — bullet senders + one-line summary; flag action items
  - **Tasks & reminders** — derived from memory and yesterday's log
  - **Suggested focus** — 2–3 short bullets, grounded in the data above

Rules:
  - Be concise. No filler.
  - Do not invent meetings or emails not present in the input.
  - If a section has no data, omit it entirely.
  - Times are in the user's local timezone.`;

export async function composeDailyBriefing(opts: {
  provider: LLMProvider;
  workspace: string;
}): Promise<string> {
  const sections: string[] = [];

  // Calendar.
  const calBlock = await fetchTodayCalendar();
  sections.push(`## Calendar (today, ISO):\n${calBlock}`);

  // Gmail (recent unread).
  const gmailBlock = await fetchRecentImportantEmails();
  sections.push(`## Gmail (recent important):\n${gmailBlock}`);

  // Memory + yesterday's daily log.
  const memory = await readWorkspaceMemory(opts.workspace);
  sections.push(`## Workspace MEMORY.md:\n${memory.trim() || '(empty)'}`);

  const yesterday = await readYesterdayLog();
  sections.push(`## Yesterday's log:\n${yesterday || '(empty)'}`);

  const userMessage = sections.join('\n\n---\n\n');

  const r = await opts.provider.complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 1024,
    temperature: 0.4,
  });

  await appendDailyLog({
    ts: new Date(),
    source: 'briefing',
    workspace: opts.workspace,
    summary: 'Generated daily briefing',
    details: r.text,
  });

  return r.text;
}

async function fetchTodayCalendar(): Promise<string> {
  if (!(await gogAvailable())) return '(gog not available; calendar skipped)';
  try {
    const out = await gog(['calendar', 'events', '--today', '--json'], {
      timeout: 15000,
    });
    return out.trim() || '(no events)';
  } catch (err) {
    if (err instanceof GogError) return `(calendar error: ${err.message})`;
    return `(calendar error: ${(err as Error).message})`;
  }
}

async function fetchRecentImportantEmails(): Promise<string> {
  if (!(await gogAvailable())) return '(gog not available; gmail skipped)';
  try {
    const out = await gog(
      ['gmail', 'search', 'is:unread newer_than:1d', '--max', '10', '--json'],
      { timeout: 15000 },
    );
    return out.trim() || '(no recent unread)';
  } catch (err) {
    if (err instanceof GogError) return `(gmail error: ${err.message})`;
    return `(gmail error: ${(err as Error).message})`;
  }
}

async function readYesterdayLog(): Promise<string> {
  const entries = (await readdir(paths.memoryDir).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();
  // Prefer the most recent log that isn't today's.
  const today = new Date().toISOString().slice(0, 10);
  const target = entries.find((e) => !e.startsWith(today));
  if (!target) return '';
  return readText(join(paths.memoryDir, target), '');
}
