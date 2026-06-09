/**
 * Context builder — gathers everything that should inform the next LLM call.
 *
 * Returns a structured `BuiltContext` rather than a final prompt string, so
 * the prompt assembler can decide ordering and the explainability log can
 * record which inputs were loaded.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';
import { loadPersonalityFiles } from '../config/load.js';
import { readWorkspaceMemory, readGlobalMemory } from '../memory/long-term.js';
import { recall, type MemoryHit } from '../memory/recall.js';
import type { Tool } from '../tools/types.js';

export interface BuiltContext {
  workspace: string;
  personality: {
    soul: string;
    identity: string;
    agents: string;
    tools: string;
    user: string;
  };
  workspaceUserOverlay: string;
  workspaceMemory: string;
  globalMemory: string;
  recentDailyLogs: Array<{ name: string; content: string }>;
  recallHits: MemoryHit[];
  tools: Tool[];
  /** What was loaded — surfaced in the explainability trace. */
  trace: { sources: string[] };
}

export interface BuildContextParams {
  workspace: string;
  /** The latest user message, used for memory recall. Optional. */
  query?: string;
  /** Available enabled tools. */
  tools: Tool[];
  /** How many recent daily logs to attach (default 3). */
  recentDays?: number;
}

export async function buildContext(params: BuildContextParams): Promise<BuiltContext> {
  const { workspace, query, tools } = params;
  const recentDays = params.recentDays ?? 3;
  const sources: string[] = [];

  const personality = await loadPersonalityFiles();
  if (personality.soul) sources.push('config/SOUL.md');
  if (personality.identity) sources.push('config/IDENTITY.md');
  if (personality.agents) sources.push('config/AGENTS.md');
  if (personality.tools) sources.push('config/TOOLS.md');
  if (personality.user) sources.push('config/USER.md');

  const workspaceUserOverlay = await readText(paths.workspaceUserFile(workspace), '');
  if (workspaceUserOverlay) sources.push(`workspaces/${workspace}/USER.md`);

  const workspaceMemory = await readWorkspaceMemory(workspace);
  if (workspaceMemory.trim().length > 30) sources.push(`workspaces/${workspace}/MEMORY.md`);

  const globalMemory = await readGlobalMemory();
  if (globalMemory.trim().length > 20) sources.push('memory/MEMORY.md');

  // Recent daily logs (full content, but capped at 3 most recent).
  const dailyEntries = (await readdir(paths.memoryDir).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, recentDays);
  const recentDailyLogs: Array<{ name: string; content: string }> = [];
  for (const name of dailyEntries) {
    const content = await readText(join(paths.memoryDir, name), '');
    if (content.trim()) {
      recentDailyLogs.push({ name, content });
      sources.push(`memory/${name}`);
    }
  }

  // Targeted memory recall against the user's query.
  let recallHits: MemoryHit[] = [];
  if (query && query.trim().length > 2) {
    recallHits = await recall({ query, workspace, limit: 6 });
    for (const h of recallHits) sources.push(`recall:${h.source}`);
  }

  return {
    workspace,
    personality,
    workspaceUserOverlay,
    workspaceMemory,
    globalMemory,
    recentDailyLogs,
    recallHits,
    tools,
    trace: { sources },
  };
}
