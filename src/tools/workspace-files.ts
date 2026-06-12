/**
 * Tool: workspace_files — list / read files inside the active workspace.
 *
 * Hard rule: paths are clamped to the workspace directory. We refuse paths
 * containing `..` after resolution, and we refuse anything that resolves
 * outside the workspace root. This enforces the AGENTS.md workspace policy.
 */
import { readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import type { Tool } from './types.js';
import { readText } from '../util/fs.js';

interface ListArgs { op: 'list'; path?: string }
interface ReadArgs { op: 'read'; path: string }
type Args = ListArgs | ReadArgs;

function clamp(workspaceDir: string, p: string): string | null {
  const target = resolve(workspaceDir, p);
  const rel = relative(workspaceDir, target);
  if (rel.startsWith('..') || rel === '..') return null;
  return target;
}

const tool: Tool = {
  name: 'workspace_files',
  description:
    'List or read files inside the active workspace directory. Use op="list" to enumerate, op="read" to read a file.',
  schema: {
    type: 'object',
    properties: {
      op: { type: 'string', enum: ['list', 'read'] },
      path: { type: 'string', description: 'Workspace-relative path. Optional for list (defaults to root).' },
    },
    required: ['op'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  async execute(args, ctx) {
    const a = args as unknown as Args;
    const ws = ctx.workspaceDir;
    if (a.op === 'list') {
      const sub = clamp(ws, a.path ?? '.');
      if (!sub) return { text: 'workspace_files: path escapes workspace.' };
      const entries = await readdir(sub, { withFileTypes: true });
      const out = entries.map((e) => `${e.isDirectory() ? 'd' : 'f'} ${join(a.path ?? '', e.name)}`);
      return { text: out.join('\n') || '(empty)' };
    }
    if (a.op === 'read') {
      const target = clamp(ws, a.path);
      if (!target) return { text: 'workspace_files: path escapes workspace.' };
      const text = await readText(target, '(empty)');
      return { text };
    }
    return { text: 'workspace_files: unknown op' };
  },
};

export default tool;
