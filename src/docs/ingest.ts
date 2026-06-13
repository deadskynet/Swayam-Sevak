/**
 * Document ingestion.
 *
 * Supported types:
 *   - .md / .txt — read as utf8
 *   - .pdf       — `pdf-parse`
 *   - .docx      — extract via simple unzip + parse (we use the doc as a zip
 *                  and pull `word/document.xml`; no extra dep). Lossy but
 *                  good enough for retrieval.
 *
 * For directories, we recurse and ingest every supported file.
 */
import { readFile, stat, readdir } from 'node:fs/promises';
import { extname, basename, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { chunkText } from './chunk.js';
import { addDoc } from './store.js';

const SUPPORTED = new Set(['.md', '.txt', '.pdf', '.docx']);

async function readPdf(path: string): Promise<string> {
  // Lazy import; avoids loading pdf-parse when not needed.
  const mod: any = await import('pdf-parse');
  const fn = mod.default ?? mod;
  const buf = await readFile(path);
  const result = await fn(buf);
  return result.text ?? '';
}

async function readDocx(path: string): Promise<string> {
  // .docx is a zip with `word/document.xml`. We extract text by stripping
  // XML tags from that one entry. No mammoth dependency.
  const buf = await readFile(path);
  const u8 = new Uint8Array(buf);
  // Minimal local-file-header zip walk.
  const dec = new TextDecoder('utf8');
  let i = 0;
  while (i + 30 < u8.length) {
    // Local file header signature: 0x04034b50 (little-endian).
    if (
      u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x03 && u8[i + 3] === 0x04
    ) {
      const compressed = (u8[i + 8]! | (u8[i + 9]! << 8)) === 8;
      const compSize = u8[i + 18]! | (u8[i + 19]! << 8) | (u8[i + 20]! << 16) | (u8[i + 21]! << 24);
      const uncompSize = u8[i + 22]! | (u8[i + 23]! << 8) | (u8[i + 24]! << 16) | (u8[i + 25]! << 24);
      const nameLen = u8[i + 26]! | (u8[i + 27]! << 8);
      const extraLen = u8[i + 28]! | (u8[i + 29]! << 8);
      const name = dec.decode(u8.slice(i + 30, i + 30 + nameLen));
      const dataStart = i + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compSize;
      if (name === 'word/document.xml') {
        const data = u8.slice(dataStart, dataEnd);
        let xml: string;
        if (compressed) {
          const { inflateRawSync } = await import('node:zlib');
          xml = inflateRawSync(Buffer.from(data)).toString('utf8');
        } else {
          xml = dec.decode(data);
        }
        // Replace paragraph breaks with newlines, strip tags.
        return xml
          .replace(/<\/w:p>/g, '\n\n')
          .replace(/<w:tab\/>/g, '\t')
          .replace(/<w:br\/>/g, '\n')
          .replace(/<[^>]+>/g, '');
      }
      i = dataEnd;
      void uncompSize;
    } else {
      i++;
    }
  }
  return '';
}

async function readSupported(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  if (ext === '.md' || ext === '.txt') return readFile(path, 'utf8');
  if (ext === '.pdf') return readPdf(path);
  if (ext === '.docx') return readDocx(path);
  throw new Error(`unsupported file type: ${ext}`);
}

export interface IngestResult {
  ingested: Array<{ path: string; chunks: number }>;
  skipped: Array<{ path: string; reason: string }>;
}

export async function ingestPath(
  workspace: string,
  inputPath: string,
): Promise<IngestResult> {
  const abs = resolve(inputPath);
  const s = await stat(abs);
  const result: IngestResult = { ingested: [], skipped: [] };
  if (s.isDirectory()) {
    for await (const fpath of walkDir(abs)) {
      const ext = extname(fpath).toLowerCase();
      if (!SUPPORTED.has(ext)) {
        result.skipped.push({ path: fpath, reason: `unsupported ${ext}` });
        continue;
      }
      await ingestSingleFile(workspace, fpath, result);
    }
  } else {
    const ext = extname(abs).toLowerCase();
    if (!SUPPORTED.has(ext)) {
      result.skipped.push({ path: abs, reason: `unsupported ${ext}` });
      return result;
    }
    await ingestSingleFile(workspace, abs, result);
  }
  return result;
}

async function* walkDir(root: string): AsyncGenerator<string> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    const fpath = resolve(root, e.name);
    if (e.isDirectory()) {
      yield* walkDir(fpath);
    } else if (e.isFile()) {
      yield fpath;
    }
  }
}

async function ingestSingleFile(
  workspace: string,
  path: string,
  out: IngestResult,
): Promise<void> {
  try {
    const text = await readSupported(path);
    if (!text.trim()) {
      out.skipped.push({ path, reason: 'empty' });
      return;
    }
    const chunks = chunkText(text);
    if (!chunks.length) {
      out.skipped.push({ path, reason: 'no chunks produced' });
      return;
    }
    const id = docIdFor(path);
    await addDoc(workspace, { id, path, chunks });
    out.ingested.push({ path, chunks: chunks.length });
  } catch (err) {
    out.skipped.push({
      path,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

function docIdFor(path: string): string {
  const h = createHash('sha1').update(path).digest('hex').slice(0, 12);
  return `${basename(path)}@${h}`;
}

export { docIdFor, relative };
