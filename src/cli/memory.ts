/**
 * `swayam memory view|distill`
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';
import { getActiveWorkspace } from '../memory/workspace.js';
import { distill } from '../memory/distill.js';
import { bootstrap } from './bootstrap.js';

export async function runMemoryView(): Promise<void> {
  const ws = await getActiveWorkspace();
  console.log(`# Workspace: ${ws}`);
  console.log();
  console.log('## Workspace MEMORY.md\n');
  console.log(await readText(paths.workspaceMemoryFile(ws), '(empty)'));
  console.log('\n## Global MEMORY.md\n');
  console.log(await readText(join(paths.memoryDir, 'MEMORY.md'), '(empty)'));

  console.log('\n## Recent daily logs');
  const entries = (await readdir(paths.memoryDir).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, 5);
  if (!entries.length) {
    console.log('(none)');
    return;
  }
  for (const f of entries) console.log(`  - data/memory/${f}`);
}

export async function runMemoryDistill(opts: { days: number }): Promise<void> {
  const { provider, workspace } = await bootstrap();
  console.error(`distilling last ${opts.days} day(s) into workspace:${workspace} MEMORY.md ...`);
  const r = await distill({ provider, workspace, days: opts.days });
  if (r.added) {
    console.log('Added:\n');
    console.log(r.content);
  } else {
    console.log(r.content);
  }
}
