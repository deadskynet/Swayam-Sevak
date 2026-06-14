/**
 * GET  /api/docs                       — list ingested documents (active workspace)
 * POST /api/docs/ingest                — multipart/form-data upload + ingest
 *
 * Multipart parsing is handled with a tiny inline parser sufficient for our
 * use case (single file field named `file`). Avoiding a multipart dep keeps
 * the bundle tight.
 */
import { json, checkToken, readBody, type RouteHandler } from './_helpers.js';
import { loadIndex } from '../../docs/store.js';
import { ingestPath } from '../../docs/ingest.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const docsList: RouteHandler = async (_req, res, _url, ctx) => {
  const idx = await loadIndex(ctx.workspace());
  json(res, 200, {
    workspace: ctx.workspace(),
    docs: idx.docs.map((d) => ({
      id: d.id,
      path: d.path,
      ingestedAt: d.ingestedAt,
      chunks: d.chunks,
    })),
    totalChunks: idx.n,
  });
};

export const docsIngest: RouteHandler = async (req, res, _url, ctx) => {
  if (!checkToken(req, res, ctx.token)) return;
  const ct = req.headers['content-type'] ?? '';
  if (!ct.startsWith('multipart/form-data')) {
    return json(res, 400, { error: 'expected multipart/form-data' });
  }
  const m = ct.match(/boundary=(.+)$/);
  if (!m) return json(res, 400, { error: 'no boundary' });
  const boundary = m[1]!.trim().replace(/^"|"$/g, '');

  const buf = await readBody(req);
  const part = extractFilePart(buf, boundary);
  if (!part) return json(res, 400, { error: 'no file field found' });

  const dir = join(tmpdir(), `swayam-upload-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, part.filename || 'upload.bin');
  await writeFile(tmp, part.body);

  const r = await ingestPath(ctx.workspace(), tmp);
  json(res, 200, r);
};

interface MultipartFilePart {
  filename: string;
  body: Buffer;
}

function extractFilePart(buf: Buffer, boundary: string): MultipartFilePart | null {
  const dashBoundary = Buffer.from(`--${boundary}`);
  const crlf = Buffer.from('\r\n');
  let pos = 0;

  while (pos < buf.length) {
    const headerStart = buf.indexOf(dashBoundary, pos);
    if (headerStart < 0) return null;
    const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd < 0) return null;

    const headerText = buf.slice(headerStart + dashBoundary.length, headerEnd).toString('utf8');
    if (headerText.startsWith('--')) return null; // end of multipart

    const bodyStart = headerEnd + 4;
    const nextBoundary = buf.indexOf(dashBoundary, bodyStart);
    if (nextBoundary < 0) return null;
    // Drop trailing CRLF before boundary.
    const bodyEnd = buf.lastIndexOf(crlf, nextBoundary - 1);
    const body = buf.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : nextBoundary);

    const dispMatch = /Content-Disposition:[^\n]*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headerText);
    if (dispMatch && dispMatch[1] === 'file') {
      return { filename: dispMatch[2] || 'upload.bin', body };
    }
    pos = nextBoundary;
  }
  return null;
}
