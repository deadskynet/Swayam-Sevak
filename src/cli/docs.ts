/**
 * `swayam docs ingest <path>`
 */
import { getActiveWorkspace } from '../memory/workspace.js';
import { ingestPath } from '../docs/ingest.js';

export async function runDocsIngest(path: string): Promise<void> {
  const ws = await getActiveWorkspace();
  console.error(`ingesting ${path} into workspace:${ws} ...`);
  const r = await ingestPath(ws, path);
  for (const i of r.ingested) console.log(`  ✓ ${i.path}  (${i.chunks} chunks)`);
  for (const s of r.skipped) console.log(`  · ${s.path}  [skipped: ${s.reason}]`);
  console.log(`\n${r.ingested.length} ingested, ${r.skipped.length} skipped.`);
}
