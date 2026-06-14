/**
 * Static asset server.
 *
 * Serves three things:
 *   • GET /             → src/web-ui/index.html, with the CSRF-style token
 *                         injected as <meta name="swayam-token" content="…">
 *   • GET /assets/*.js  → transpiled frontend modules. In dev (tsx) we
 *                         transform on the fly. In a tsup build we serve from
 *                         dist/web-ui/.
 *   • GET /assets/*.css → src/web-ui/style.css
 *
 * All paths are clamped to the web-ui directory; no traversal.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const webUiSrc = resolve(here, '..', 'web-ui');
const distWebUi = resolve(here, '..', '..', 'dist', 'web-ui');

const MIMES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

export interface StaticOptions {
  token: string;
}

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  opts: StaticOptions,
): Promise<boolean> {
  if (req.method !== 'GET') return false;

  // Index.
  if (url.pathname === '/' || url.pathname === '/index.html') {
    let html = await readFile(join(webUiSrc, 'index.html'), 'utf8');
    html = html.replace(
      '<!--SWAYAM_TOKEN-->',
      `<meta name="swayam-token" content="${opts.token}">`,
    );
    res.writeHead(200, { 'Content-Type': MIMES['.html']! });
    res.end(html);
    return true;
  }

  if (!url.pathname.startsWith('/assets/')) return false;

  const rel = url.pathname.slice('/assets/'.length);
  if (!rel || rel.includes('..')) {
    res.writeHead(403); res.end('forbidden'); return true;
  }
  const candidates = [
    join(distWebUi, rel),  // built
    join(webUiSrc, rel),   // dev
  ];

  // .ts in dev: transform via tsx's API (loaded lazily so we don't pay the
  // cost at import time).
  if (rel.endsWith('.ts')) {
    const srcPath = join(webUiSrc, rel);
    if (!safe(srcPath, webUiSrc)) {
      res.writeHead(403); res.end('forbidden'); return true;
    }
    try {
      const src = await readFile(srcPath, 'utf8');
      // Lazy-load esbuild (a tsx transitive dep). If this module path drifts,
      // we fall back to serving the raw .ts which modern browsers reject —
      // surfaced clearly in the network panel.
      const esbuild = await import('esbuild');
      const out = await esbuild.transform(src, {
        loader: 'ts',
        format: 'esm',
        target: 'es2022',
        sourcemap: 'inline',
      });
      res.writeHead(200, { 'Content-Type': MIMES['.js']! });
      res.end(out.code);
      return true;
    } catch (err) {
      res.writeHead(500);
      res.end(`/* transform failed: ${(err as Error).message} */`);
      return true;
    }
  }

  for (const path of candidates) {
    if (!safe(path, dirname(path) === distWebUi ? distWebUi : webUiSrc)) continue;
    try {
      const s = await stat(path);
      if (!s.isFile()) continue;
      const buf = await readFile(path);
      res.writeHead(200, {
        'Content-Type': MIMES[extname(path)] ?? 'application/octet-stream',
      });
      res.end(buf);
      return true;
    } catch {
      // try next
    }
  }
  res.writeHead(404); res.end('not found');
  return true;
}

function safe(target: string, root: string): boolean {
  const r = relative(root, target);
  return !r.startsWith('..') && r !== '..';
}
