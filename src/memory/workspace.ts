/**
 * Workspace switching.
 *
 * The active workspace name is persisted in `data/active-workspace`.
 * Switching is a single file write; the next CLI invocation picks up the
 * change. Inside a long-running CLI session (chat REPL, telegram bot) the
 * active workspace is read once at startup.
 */
import { readdir } from 'node:fs/promises';
import { paths } from '../config/paths.js';
import { readText, writeText, ensureDir } from '../util/fs.js';
import { join } from 'node:path';

export const DEFAULT_WORKSPACE = 'personal';

export async function getActiveWorkspace(): Promise<string> {
  const raw = await readText(paths.activeWorkspaceFile, DEFAULT_WORKSPACE);
  return raw.trim() || DEFAULT_WORKSPACE;
}

export async function setActiveWorkspace(name: string): Promise<void> {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
    throw new Error(`invalid workspace name: ${name}`);
  }
  await writeText(paths.activeWorkspaceFile, name + '\n');
}

export async function listWorkspaces(): Promise<string[]> {
  await ensureDir(paths.workspacesDir);
  const entries = await readdir(paths.workspacesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function createWorkspace(name: string): Promise<void> {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
    throw new Error(`invalid workspace name: ${name}`);
  }
  const dir = paths.workspaceDir(name);
  await ensureDir(dir);
  await ensureDir(paths.workspaceDocsDir(name));
  await ensureDir(paths.workspaceNotesDir(name));
  await writeText(
    join(dir, 'USER.md'),
    `# USER.md (workspace: ${name})\n\nWorkspace-scoped overrides go here.\n`,
  );
  await writeText(
    join(dir, 'MEMORY.md'),
    `# Workspace: ${name} — MEMORY.md\n`,
  );
}
