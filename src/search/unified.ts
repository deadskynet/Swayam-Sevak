/**
 * Unified search — fan out across memory, docs, and (if available) Gmail.
 *
 * This is intentionally not an LLM call — it's a deterministic aggregator.
 * The LLM can call this via the orchestrator if a chat conversation needs
 * synthesis, but the CLI's `swayam search` returns raw matches so the user
 * stays in control.
 */
import { recall, type MemoryHit } from '../memory/recall.js';
import { searchIndex, type DocsSearchHit } from '../docs/store.js';
import { gogAvailable, gog, GogError } from '../integrations/gogcli.js';

export interface UnifiedSearchResult {
  query: string;
  workspace: string;
  memory: MemoryHit[];
  docs: DocsSearchHit[];
  gmail: { ok: boolean; raw?: string; error?: string };
}

export async function unifiedSearch(opts: {
  workspace: string;
  query: string;
  limit?: number;
}): Promise<UnifiedSearchResult> {
  const limit = opts.limit ?? 5;

  const tasks: Array<Promise<unknown>> = [
    recall({ workspace: opts.workspace, query: opts.query, limit }),
    searchIndex(opts.workspace, opts.query, limit),
    searchGmail(opts.query),
  ];
  const [memory, docs, gmail] = (await Promise.all(tasks)) as [
    MemoryHit[],
    DocsSearchHit[],
    UnifiedSearchResult['gmail'],
  ];
  return { query: opts.query, workspace: opts.workspace, memory, docs, gmail };
}

async function searchGmail(query: string): Promise<UnifiedSearchResult['gmail']> {
  if (!(await gogAvailable())) {
    return { ok: false, error: '`gog` not on PATH; gmail skipped.' };
  }
  try {
    const out = await gog(['gmail', 'search', '--json', '--max', '5', '--', query], { timeout: 15000 });
    return { ok: true, raw: out.trim() };
  } catch (err) {
    if (err instanceof GogError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatUnifiedSearch(r: UnifiedSearchResult): string {
  const out: string[] = [];
  out.push(`# Search: "${r.query}"   (workspace: ${r.workspace})`);

  out.push('\n## Memory');
  if (!r.memory.length) out.push('(no memory hits)');
  else for (const m of r.memory) out.push(`- [${m.source}] (score ${m.score})\n  ${m.text.split('\n')[0]}`);

  out.push('\n## Documents');
  if (!r.docs.length) out.push('(no document hits)');
  else for (const d of r.docs) out.push(`- ${d.path} chunk ${d.idx} (score ${d.score.toFixed(3)})\n  ${d.text.slice(0, 200)}…`);

  out.push('\n## Gmail');
  if (r.gmail.ok) out.push(r.gmail.raw ?? '(empty)');
  else out.push(`(gmail unavailable: ${r.gmail.error})`);

  return out.join('\n');
}
