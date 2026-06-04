/**
 * Absolute paths for repo, config, and runtime data directories.
 *
 * All paths are resolved once at import time so the rest of the codebase can
 * import them as constants. Override `SWAYAM_DATA_DIR` in `.env` to keep state
 * outside the repo (e.g. in `~/.swayam-sevak`).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

// __dirname for ESM. This file lives at <repo>/src/config/paths.ts.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const dataDir = process.env.SWAYAM_DATA_DIR
  ? resolve(process.env.SWAYAM_DATA_DIR)
  : join(repoRoot, 'data');

export const paths = {
  repoRoot,
  configDir: join(repoRoot, 'config'),

  dataDir,
  memoryDir: join(dataDir, 'memory'),
  sessionsDir: join(dataDir, 'sessions'),
  workspacesDir: join(dataDir, 'workspaces'),
  docsIndexDir: join(dataDir, 'docs-index'),
  schedulesFile: join(dataDir, 'schedules.json'),
  activeWorkspaceFile: join(dataDir, 'active-workspace'),

  // Per-workspace path helpers.
  workspaceDir: (name: string) => join(dataDir, 'workspaces', name),
  workspaceUserFile: (name: string) => join(dataDir, 'workspaces', name, 'USER.md'),
  workspaceMemoryFile: (name: string) => join(dataDir, 'workspaces', name, 'MEMORY.md'),
  workspaceDocsDir: (name: string) => join(dataDir, 'workspaces', name, 'documents'),
  workspaceNotesDir: (name: string) => join(dataDir, 'workspaces', name, 'notes'),
} as const;
