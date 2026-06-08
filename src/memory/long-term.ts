/**
 * Long-term memory — read/write of MEMORY.md files.
 *
 * There are two scopes:
 *   - Global memory:    data/memory/MEMORY.md
 *   - Workspace memory: data/workspaces/<name>/MEMORY.md
 *
 * Both are plain markdown. We never silently overwrite — appends only,
 * with date-stamped sections.
 */
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText, appendText } from '../util/fs.js';

export const globalMemoryPath = (): string => join(paths.memoryDir, 'MEMORY.md');
export const workspaceMemoryPath = (workspace: string): string =>
  paths.workspaceMemoryFile(workspace);

export async function readGlobalMemory(): Promise<string> {
  return readText(globalMemoryPath(), '# MEMORY.md\n');
}

export async function readWorkspaceMemory(workspace: string): Promise<string> {
  return readText(
    workspaceMemoryPath(workspace),
    `# Workspace: ${workspace} — MEMORY.md\n`,
  );
}

/** Append a date-stamped section to MEMORY.md. */
export async function appendGlobalMemory(
  section: string,
  body: string,
): Promise<void> {
  const stamp = new Date().toISOString();
  await appendText(
    globalMemoryPath(),
    `\n## ${section} · ${stamp}\n\n${body.trim()}\n`,
  );
}

export async function appendWorkspaceMemory(
  workspace: string,
  section: string,
  body: string,
): Promise<void> {
  const stamp = new Date().toISOString();
  await appendText(
    workspaceMemoryPath(workspace),
    `\n## ${section} · ${stamp}\n\n${body.trim()}\n`,
  );
}
