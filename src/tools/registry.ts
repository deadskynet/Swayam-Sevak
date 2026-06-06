/**
 * Dynamic tool registry.
 *
 * Scans `src/tools/*.ts` (or the built `dist/tools/*.js`) and imports each
 * default export as a `Tool`. Files starting with `_` and the type/registry
 * files themselves are skipped.
 *
 * In dev (tsx) the source dir is scanned. In a built tsup bundle there is no
 * `src/tools/` on disk, so we accept an explicit `loadStaticTools()` that the
 * bundle calls — or, simpler, the CLI is run via tsx in v1 (build emits a
 * single bundle but the tools directory remains importable since we ship
 * source). For now we read from `src/tools/`.
 */
import { readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Tool } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));

const SKIP = new Set(['types.ts', 'types.js', 'registry.ts', 'registry.js']);

export async function loadTools(): Promise<Tool[]> {
  const dir = resolve(here);
  const entries = await readdir(dir);
  const tools: Tool[] = [];
  for (const f of entries) {
    if (SKIP.has(f)) continue;
    if (f.startsWith('_')) continue;
    if (!(f.endsWith('.ts') || f.endsWith('.js'))) continue;
    const url = pathToFileURL(join(dir, f)).href;
    try {
      const mod = await import(url);
      const tool = (mod.default ?? mod.tool) as Tool | undefined;
      if (!tool || typeof tool.execute !== 'function') continue;
      tools.push(tool);
    } catch (err) {
      // Surface but don't fail the whole registry — a broken tool shouldn't
      // take the assistant down.
      console.error(`[tools] failed to load ${f}:`, err);
    }
  }
  // Stable ordering for predictable system prompts.
  tools.sort((a, b) => a.name.localeCompare(b.name));
  return tools;
}

export interface RegistrySnapshot {
  enabled: Tool[];
  disabled: Array<{ tool: Tool; reason: string }>;
}

/** Partitions tools by their `disabled()` predicate. */
export async function snapshot(tools: Tool[]): Promise<RegistrySnapshot> {
  const enabled: Tool[] = [];
  const disabled: Array<{ tool: Tool; reason: string }> = [];
  for (const t of tools) {
    const isDisabled = t.disabled ? await t.disabled() : false;
    if (isDisabled) disabled.push({ tool: t, reason: t.disabledReason ?? 'unavailable' });
    else enabled.push(t);
  }
  return { enabled, disabled };
}
