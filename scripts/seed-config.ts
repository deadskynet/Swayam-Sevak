/**
 * Seed runtime state on first run.
 *
 * - Ensures `data/` and its subdirectories exist.
 * - Creates a default `personal` workspace if no workspaces exist yet.
 * - Initialises empty `MEMORY.md` files where missing.
 *
 * The `config/*.md` defaults are committed in the repo and not copied here —
 * they are read in place. Workspace overlays are created on demand.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../src/config/paths.js';

const exists = async (p: string) => {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

async function ensureFile(path: string, contents: string) {
  if (await exists(path)) return;
  await writeFile(path, contents, 'utf8');
}

async function main() {
  const dirs = [
    paths.dataDir,
    paths.memoryDir,
    paths.sessionsDir,
    paths.workspacesDir,
    paths.docsIndexDir,
    join(paths.workspacesDir, 'personal'),
    join(paths.workspacesDir, 'personal', 'documents'),
    join(paths.workspacesDir, 'personal', 'notes'),
  ];
  for (const d of dirs) await mkdir(d, { recursive: true });

  await ensureFile(
    join(paths.memoryDir, 'MEMORY.md'),
    '# MEMORY.md\n\nLong-term distilled memory. Edit freely.\n',
  );
  await ensureFile(
    join(paths.workspacesDir, 'personal', 'MEMORY.md'),
    '# Workspace: personal — MEMORY.md\n',
  );
  await ensureFile(
    join(paths.workspacesDir, 'personal', 'USER.md'),
    '# USER.md (workspace: personal)\n\nWorkspace-scoped overrides go here.\n',
  );
  await ensureFile(
    paths.schedulesFile,
    JSON.stringify({ schedules: [] }, null, 2) + '\n',
  );
  await ensureFile(
    paths.activeWorkspaceFile,
    'personal\n',
  );

  console.log('seed complete:', paths.dataDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
