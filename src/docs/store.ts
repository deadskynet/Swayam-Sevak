/**
 * On-disk index for ingested documents — TF-IDF over chunks.
 *
 * One JSON file per workspace at `data/docs-index/<workspace>.json`. The file
 * holds:
 *   - `docs`: each ingested document's metadata (path, ingest date, chunk count)
 *   - `chunks`: { docId, idx, text, tf }
 *   - `df`:    document-frequency per term (used for IDF at query time)
 *   - `n`:     total number of chunks
 *
 * Why not LanceDB or sqlite-vss? — Single user, kilobytes-to-low-megabytes of
 * text. JSON is human-inspectable, dependency-free, and rebuilds in seconds.
 * The interface here is small (`addDoc`, `search`, `removeDoc`), so swapping
 * to a vector store is a straight refactor when the corpus outgrows JSON.
 */
import { readJson, writeJson } from '../util/fs.js';
import { paths } from '../config/paths.js';
import { join } from 'node:path';

export interface ChunkRow {
  docId: string;
  idx: number;
  text: string;
  /** Term frequency map for this chunk. */
  tf: Record<string, number>;
}

export interface DocRow {
  id: string;
  path: string;
  ingestedAt: string;
  chunks: number;
}

export interface IndexFile {
  version: 1;
  docs: DocRow[];
  chunks: ChunkRow[];
  df: Record<string, number>;
  n: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'of',
  'in', 'on', 'for', 'to', 'with', 'this', 'that', 'it', 'be', 'as', 'at',
  'by', 'from', 'do', 'have', 'has', 'had', 'i', 'you', 'me', 'my',
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return tf;
}

const indexPath = (workspace: string): string =>
  join(paths.docsIndexDir, `${workspace}.json`);

const empty = (): IndexFile => ({ version: 1, docs: [], chunks: [], df: {}, n: 0 });

export async function loadIndex(workspace: string): Promise<IndexFile> {
  return readJson<IndexFile>(indexPath(workspace), empty());
}

export async function saveIndex(workspace: string, idx: IndexFile): Promise<void> {
  await writeJson(indexPath(workspace), idx);
}

export async function addDoc(
  workspace: string,
  doc: { id: string; path: string; chunks: { idx: number; text: string }[] },
): Promise<void> {
  const index = await loadIndex(workspace);

  // If the doc already exists, remove and re-add.
  removeDocFromIndexInPlace(index, doc.id);

  index.docs.push({
    id: doc.id,
    path: doc.path,
    ingestedAt: new Date().toISOString(),
    chunks: doc.chunks.length,
  });

  for (const c of doc.chunks) {
    const tokens = tokenize(c.text);
    const tf = termFreq(tokens);
    index.chunks.push({ docId: doc.id, idx: c.idx, text: c.text, tf });
    for (const term of Object.keys(tf)) {
      index.df[term] = (index.df[term] ?? 0) + 1;
    }
    index.n += 1;
  }

  await saveIndex(workspace, index);
}

export async function removeDoc(workspace: string, docId: string): Promise<void> {
  const index = await loadIndex(workspace);
  removeDocFromIndexInPlace(index, docId);
  await saveIndex(workspace, index);
}

function removeDocFromIndexInPlace(index: IndexFile, docId: string): void {
  const before = index.chunks.length;
  const removedChunks = index.chunks.filter((c) => c.docId === docId);
  index.chunks = index.chunks.filter((c) => c.docId !== docId);
  index.docs = index.docs.filter((d) => d.id !== docId);
  for (const c of removedChunks) {
    for (const term of Object.keys(c.tf)) {
      index.df[term] = (index.df[term] ?? 1) - 1;
      if ((index.df[term] ?? 0) <= 0) delete index.df[term];
    }
  }
  index.n = Math.max(0, index.n - (before - index.chunks.length));
}

export interface DocsSearchHit {
  docId: string;
  path: string;
  idx: number;
  text: string;
  score: number;
}

/** TF-IDF cosine similarity. Returns top-K matching chunks. */
export async function searchIndex(
  workspace: string,
  query: string,
  limit = 5,
): Promise<DocsSearchHit[]> {
  const index = await loadIndex(workspace);
  if (index.n === 0) return [];

  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const qtf = termFreq(qTokens);
  const idf = (term: string): number => {
    const dfn = index.df[term] ?? 0;
    if (dfn === 0) return 0;
    return Math.log((1 + index.n) / (1 + dfn)) + 1;
  };
  const qVec: Record<string, number> = {};
  let qNorm = 0;
  for (const term of Object.keys(qtf)) {
    const w = qtf[term]! * idf(term);
    qVec[term] = w;
    qNorm += w * w;
  }
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return [];

  const docPath = (id: string) => index.docs.find((d) => d.id === id)?.path ?? id;
  const hits: DocsSearchHit[] = [];

  for (const c of index.chunks) {
    let dot = 0;
    let dNorm = 0;
    for (const term of Object.keys(c.tf)) {
      const w = c.tf[term]! * idf(term);
      dNorm += w * w;
      if (qVec[term] !== undefined) dot += w * qVec[term];
    }
    if (dot === 0) continue;
    const sim = dot / (Math.sqrt(dNorm) * qNorm);
    hits.push({
      docId: c.docId,
      path: docPath(c.docId),
      idx: c.idx,
      text: c.text,
      score: sim,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
