/**
 * Swayam web server.
 *
 * Tiny `node:http` server bound to 127.0.0.1. Routes are matched explicitly
 * — no router framework. Static assets fall through if no API route matched.
 *
 * Security:
 *   - Listen on 127.0.0.1 only (refuse non-loopback addresses).
 *   - Random per-process token; required on every POST via x-swayam-token.
 *     The token is injected into index.html on GET / so the same-origin SPA
 *     can read it from <meta>. Cross-origin pages can't read DOM nor headers.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { serveStatic } from './static.js';
import { stateRoute } from './routes/state.js';
import { workspacesList, workspacesUse, workspacesCreate } from './routes/workspaces.js';
import { chatRoute } from './routes/chat.js';
import { confirmRoute } from './routes/confirm.js';
import { memoryRoot, memoryLog } from './routes/memory.js';
import { sessionsList } from './routes/sessions.js';
import { docsList, docsIngest } from './routes/docs.js';
import { searchRoute } from './routes/search.js';
import type { RouteContext, RouteHandler } from './routes/_helpers.js';
import type { LLMProvider } from '../llm/types.js';
import type { Tool } from '../tools/types.js';
import { logger } from '../util/logger.js';

interface Route {
  method: 'GET' | 'POST';
  path: string;
  handler: RouteHandler;
}

export interface StartWebOptions {
  provider: LLMProvider;
  tools: Tool[];
  enabledTools: Tool[];
  workspace: string;
  port?: number;
  /** When set, log nothing on each request (useful in tests). */
  quiet?: boolean;
}

export interface StartedWebServer {
  port: number;
  token: string;
  url: string;
  stop: () => Promise<void>;
}

export async function startWebServer(opts: StartWebOptions): Promise<StartedWebServer> {
  const token = randomBytes(16).toString('hex');
  let activeWorkspace = opts.workspace;

  const ctx: RouteContext = {
    provider: opts.provider,
    tools: opts.tools,
    enabledTools: opts.enabledTools,
    workspace: () => activeWorkspace,
    setWorkspace: (n) => { activeWorkspace = n; },
    token,
  };

  const routes: Route[] = [
    { method: 'GET',  path: '/api/state',             handler: stateRoute },
    { method: 'GET',  path: '/api/workspaces',        handler: workspacesList },
    { method: 'POST', path: '/api/workspaces/use',    handler: workspacesUse },
    { method: 'POST', path: '/api/workspaces/create', handler: workspacesCreate },
    { method: 'POST', path: '/api/chat',              handler: chatRoute },
    { method: 'POST', path: '/api/confirm',           handler: confirmRoute },
    { method: 'GET',  path: '/api/memory',            handler: memoryRoot },
    { method: 'GET',  path: '/api/memory/log',        handler: memoryLog },
    { method: 'GET',  path: '/api/sessions',          handler: sessionsList },
    { method: 'GET',  path: '/api/docs',              handler: docsList },
    { method: 'POST', path: '/api/docs/ingest',       handler: docsIngest },
    { method: 'POST', path: '/api/search',            handler: searchRoute },
  ];

  const server = createServer(async (req, res) => {
    try {
      // Localhost-only.
      const ra = req.socket.remoteAddress;
      if (ra && ra !== '127.0.0.1' && ra !== '::1' && ra !== '::ffff:127.0.0.1') {
        res.writeHead(403); res.end('forbidden: localhost only'); return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const route = routes.find(
        (r) => r.method === req.method && r.path === url.pathname,
      );
      if (route) {
        if (!opts.quiet) logger.info('web', `${req.method} ${url.pathname}`);
        await route.handler(req, res, url, ctx);
        return;
      }

      // Static fallthrough.
      const handled = await serveStatic(req, res, url, { token });
      if (!handled) { res.writeHead(404); res.end('not found'); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('web', 'unhandled', { error: msg });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => {
    server.listen({ host: '127.0.0.1', port: opts.port ?? 7878 }, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port ?? 7878;
  const url = `http://127.0.0.1:${port}`;

  return {
    port,
    token,
    url,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
