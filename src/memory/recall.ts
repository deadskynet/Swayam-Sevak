/**
 * Memory recall — selection strategy.
 *
 * For v1 we use a transparent ranking:
 *   - Recency: recent daily logs weighted higher.
 *   - Keyword overlap: case-insensitive token intersection between query and
 *     each MEMORY.md section.
 *   - Workspace scope: workspace memory always preferred over global memory
 *     when both match.
 *
 * The function returns small chunks (sections) rather than entire files, so
 * the context builder can include only what's relevant.
 *
 * Why no embeddings here?  The memory volume per user is small (kilobytes per
 * day). Token-overlap ranking is explainable, runs in <1ms, and costs nothing.
 * If a workspace's MEMORY.md grows past a few thousand lines, we add embedding
 * recall as a second pass — noted in ROADMAP.md.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readText } from '../util/fs.js';

export interface MemoryHit {
  source: string;     // path-relative label
  text: string;       // section body
  score: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'you', 'me', 'my',
  'and', 'or', 'but', 'of', 'in', 'on', 'for', 'to', 'with', 'this', 'that',
  'it', 'be', 'as', 'at', 'by', 'from', 'do', 'have', 'has', 'had',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Splits a markdown file into `## ` headed sections. */
function sections(md: string): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string }> = [];
  let cur = { heading: '', body: '' };
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      if (cur.heading || cur.body.trim()) out.push(cur);
      cur = { heading: line.replace(/^## /, '').trim(), body: '' };
    } else {
      cur.body += line + '\n';
    }
  }
  if (cur.heading || cur.body.trim()) out.push(cur);
  return out;
}

function scoreSection(qtokens: Set<string>, sec: { heading: string; body: string }): number {
  const stokens = new Set(tokenize(`${sec.heading} ${sec.body}`));
  let overlap = 0;
  for (const t of qtokens) if (stokens.has(t)) overlap++;
  return overlap;
}

export interface RecallParams {
  query: string;
  workspace: string;
  /** How many recent daily logs to scan. */
  recentDays?: number;
  /** Top-K hits to return. */
  limit?: number;
}

export async function recall(params: RecallParams): Promise<MemoryHit[]> {
  const { query, workspace } = params;
  const recentDays = params.recentDays ?? 5;
  const limit = params.limit ?? 6;
  const qtokens = new Set(tokenize(query));
  if (qtokens.size === 0) return [];

  const hits: MemoryHit[] = [];

  // 1. Workspace MEMORY.md (preferred)
  const wsMd = await readText(paths.workspaceMemoryFile(workspace), '');
  for (const sec of sections(wsMd)) {
    const s = scoreSection(qtokens, sec);
    if (s > 0) {
      hits.push({
        source: `workspace:${workspace}/MEMORY.md#${sec.heading}`,
        text: `${sec.heading}\n${sec.body.trim()}`,
        score: s + 1, // workspace bonus
      });
    }
  }

  // 2. Global MEMORY.md
  const globalMd = await readText(join(paths.memoryDir, 'MEMORY.md'), '');
  for (const sec of sections(globalMd)) {
    const s = scoreSection(qtokens, sec);
    if (s > 0) {
      hits.push({
        source: `MEMORY.md#${sec.heading}`,
        text: `${sec.heading}\n${sec.body.trim()}`,
        score: s,
      });
    }
  }

  // 3. Recent daily logs
  const logFiles = await listRecentDailyLogs(recentDays);
  for (const path of logFiles) {
    const md = await readText(path, '');
    for (const sec of sections(md)) {
      const s = scoreSection(qtokens, sec);
      if (s > 0) {
        hits.push({
          source: `daily:${path.split('/').slice(-1)[0]}#${sec.heading}`,
          text: `${sec.heading}\n${sec.body.trim()}`,
          score: s + 0.5, // recency bonus
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

async function listRecentDailyLogs(days: number): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(paths.memoryDir);
  } catch {
    return [];
  }
  const dayFiles = entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, days);
  return dayFiles.map((f) => join(paths.memoryDir, f));
}
