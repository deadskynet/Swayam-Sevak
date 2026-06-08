/**
 * Daily log writer.
 *
 * Appends a structured but human-readable entry to `data/memory/YYYY-MM-DD.md`.
 * One file per local day, scoped to the active workspace? — No: daily logs are
 * cross-workspace by design (they record assistant activity in time, not in
 * topic). Workspaces have their own MEMORY.md for topic-scoped memory.
 */
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { appendText } from '../util/fs.js';

export interface DailyLogEntry {
  ts: Date;
  source: string;            // 'chat' | 'gmail' | 'calendar' | 'briefing' | ...
  workspace: string;
  summary: string;           // one-line headline
  details?: string;          // optional multi-line body
}

function dailyLogPath(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return join(paths.memoryDir, `${y}-${m}-${d}.md`);
}

export async function appendDailyLog(entry: DailyLogEntry): Promise<void> {
  const path = dailyLogPath(entry.ts);
  const header = `\n## ${entry.ts.toISOString()} · [${entry.source}] · workspace:${entry.workspace}\n`;
  const body =
    `${entry.summary}\n` +
    (entry.details ? `\n${entry.details.trim()}\n` : '');
  await appendText(path, header + body);
}

export function todaysLogPath(): string {
  return dailyLogPath();
}
