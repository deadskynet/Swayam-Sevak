/**
 * Scheduler — persists named cron tasks in `data/schedules.json` and runs
 * them with `node-cron`.
 *
 * A schedule's `action` is a swayam CLI subcommand string (e.g. `"briefing"`,
 * `"weekly"`). When fired, the scheduler spawns the same `node` process via
 * `tsx src/cli/index.ts <action>`. This keeps the scheduler agnostic of what
 * each action does — they're all just first-class CLI commands.
 *
 * `data/schedules.json` schema:
 *   { schedules: Schedule[] }
 *
 * The scheduler is started by `swayam telegram start` and by an explicit
 * `swayam scheduler start` (added later if needed). For now, scheduling is
 * "register and run-on-demand" — i.e. the user starts the long-running bot
 * and the scheduler runs alongside it. Without a long-running process,
 * cron entries are inert.
 */
import nodeCron from 'node-cron';
import { spawn } from 'node:child_process';
import { paths } from '../config/paths.js';
import { readJson, writeJson } from '../util/fs.js';

export interface Schedule {
  id: string;
  description: string; // original NL input
  cron: string;
  action: string; // CLI argument string, e.g. "briefing" or "ask 'morning focus'"
  createdAt: string;
}

interface ScheduleFile {
  schedules: Schedule[];
}

const empty = (): ScheduleFile => ({ schedules: [] });

export async function loadSchedules(): Promise<Schedule[]> {
  const f = await readJson<ScheduleFile>(paths.schedulesFile, empty());
  return f.schedules;
}

export async function saveSchedules(s: Schedule[]): Promise<void> {
  await writeJson(paths.schedulesFile, { schedules: s });
}

export async function addSchedule(item: Omit<Schedule, 'id' | 'createdAt'>): Promise<Schedule> {
  const list = await loadSchedules();
  const id = makeId();
  const full: Schedule = { ...item, id, createdAt: new Date().toISOString() };
  list.push(full);
  await saveSchedules(list);
  return full;
}

export async function removeSchedule(id: string): Promise<boolean> {
  const list = await loadSchedules();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await saveSchedules(next);
  return true;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Wire all persisted schedules into node-cron in the current process.
 * Returns a stop() that tears them down.
 */
export async function startScheduler(): Promise<() => void> {
  const list = await loadSchedules();
  const tasks: nodeCron.ScheduledTask[] = [];
  for (const s of list) {
    if (!nodeCron.validate(s.cron)) {
      console.error(`[scheduler] invalid cron for ${s.id}: ${s.cron}`);
      continue;
    }
    const t = nodeCron.schedule(s.cron, () => fire(s));
    tasks.push(t);
    console.error(`[scheduler] registered ${s.id} (${s.cron}) -> ${s.action}`);
  }
  return () => {
    for (const t of tasks) t.stop();
  };
}

function fire(s: Schedule): void {
  const parts = parseAction(s.action);
  const child = spawn('node', [
    '--import', 'tsx',
    new URL('../cli/index.ts', import.meta.url).pathname,
    ...parts,
  ], {
    stdio: 'inherit',
    detached: false,
  });
  child.on('error', (err) => {
    console.error(`[scheduler] ${s.id} failed:`, err.message);
  });
}

/** Trivial action splitter — supports single-quoted args. */
function parseAction(action: string): string[] {
  const out: string[] = [];
  let buf = '';
  let q: '"' | "'" | null = null;
  for (let i = 0; i < action.length; i++) {
    const c = action[i]!;
    if (q) {
      if (c === q) q = null;
      else buf += c;
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (c === ' ') {
      if (buf) {
        out.push(buf);
        buf = '';
      }
    } else {
      buf += c;
    }
  }
  if (buf) out.push(buf);
  return out;
}
