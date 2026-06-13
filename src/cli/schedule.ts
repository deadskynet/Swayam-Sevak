/**
 * `swayam schedule add|list|remove`
 */
import { bootstrap } from './bootstrap.js';
import { nlToCron } from '../scheduler/nl-to-cron.js';
import { addSchedule, loadSchedules, removeSchedule } from '../scheduler/scheduler.js';

const ACTION_RULES: Array<{ re: RegExp; action: string }> = [
  { re: /\bweekly\s+review\b/i, action: 'weekly' },
  { re: /\bbriefing\b/i, action: 'briefing' },
  { re: /\bagenda\b/i, action: 'briefing' },
  { re: /\bdistill\b/i, action: 'memory distill' },
];

export async function runScheduleAdd(description: string): Promise<void> {
  const { provider } = await bootstrap();
  const r = await nlToCron(provider, description);
  if (!r.ok) {
    console.error(`Could not parse schedule: ${r.error}`);
    if (r.reply) console.error(`Model reply: ${r.reply}`);
    process.exit(1);
  }
  const action =
    ACTION_RULES.find((rule) => rule.re.test(description))?.action ?? `ask '${description}'`;
  const s = await addSchedule({ description, cron: r.cron, action });
  console.log(`Scheduled ${s.id}: ${s.cron}  →  ${s.action}`);
  console.log('Note: schedules run only while a long-running swayam process is up.');
}

export async function runScheduleList(): Promise<void> {
  const list = await loadSchedules();
  if (!list.length) {
    console.log('(no schedules)');
    return;
  }
  for (const s of list) {
    console.log(`  ${s.id}  ${s.cron}  →  ${s.action}`);
    console.log(`         "${s.description}"`);
  }
}

export async function runScheduleRemove(id: string): Promise<void> {
  const ok = await removeSchedule(id);
  console.log(ok ? `removed ${id}` : `no schedule with id ${id}`);
}
