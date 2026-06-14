/**
 * `swayam tools` — show registered tools, grouped, with provider/workspace
 * status at the top.
 */
import { loadTools, snapshot } from '../tools/registry.js';
import { loadRuntimeConfig } from '../config/load.js';
import { getActiveWorkspace } from '../memory/workspace.js';

const GROUPS: Array<{ title: string; match: (name: string) => boolean }> = [
  { title: 'Memory & workspace', match: (n) => /^(memory_|workspace_|now)/.test(n) },
  { title: 'Documents',          match: (n) => n.startsWith('docs_') },
  { title: 'Email (Gmail)',      match: (n) => n.startsWith('gmail_') },
  { title: 'Calendar',           match: (n) => n.startsWith('calendar_') },
  { title: 'Scheduling',         match: (n) => n.startsWith('schedule_') },
  { title: 'Meetings',           match: (n) => n.startsWith('meeting_') },
];

export async function runToolsList(): Promise<void> {
  const cfg = loadRuntimeConfig();
  const workspace = await getActiveWorkspace();

  console.log(`provider:  ${cfg.provider}`);
  console.log(`workspace: ${workspace}`);
  console.log();

  const tools = await loadTools();
  const snap = await snapshot(tools);

  for (const group of GROUPS) {
    const inGroup = snap.enabled.filter((t) => group.match(t.name));
    if (!inGroup.length) continue;
    console.log(`${group.title}`);
    for (const t of inGroup) {
      const conf = t.requiresConfirmation ? '  ⚠ requires confirmation' : '';
      console.log(`  • ${t.name}${conf}`);
      console.log(`      ${t.description}`);
    }
    console.log();
  }

  // Anything that didn't match a group falls into "Other".
  const grouped = new Set(GROUPS.flatMap((g) => snap.enabled.filter((t) => g.match(t.name)).map((t) => t.name)));
  const other = snap.enabled.filter((t) => !grouped.has(t.name));
  if (other.length) {
    console.log('Other');
    for (const t of other) {
      const conf = t.requiresConfirmation ? '  ⚠ requires confirmation' : '';
      console.log(`  • ${t.name}${conf}`);
      console.log(`      ${t.description}`);
    }
    console.log();
  }

  if (snap.disabled.length) {
    console.log('Unavailable (missing setup)');
    for (const { tool, reason } of snap.disabled) {
      console.log(`  ✗ ${tool.name} — ${reason}`);
    }
  }
}
