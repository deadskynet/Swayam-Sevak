/**
 * Shared route types and helpers.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LLMProvider } from '../../llm/types.js';
import type { Tool } from '../../tools/types.js';

export interface RouteContext {
  provider: LLMProvider;
  tools: Tool[];
  enabledTools: Tool[];
  /** Active workspace at server startup. Workspace switching mutates this. */
  workspace: () => string;
  setWorkspace: (name: string) => void;
  token: string;
}

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: RouteContext,
) => Promise<void>;

export function json(res: ServerResponse, status: number, body: unknown): void {
  const out = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(out).toString(),
  });
  res.end(out);
}

export async function readBody(req: IncomingMessage, max = 32 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const buf = await readBody(req);
  if (buf.length === 0) return {} as T;
  return JSON.parse(buf.toString('utf8')) as T;
}

/** Verify the CSRF-style token. Returns true if valid; sends 403 + ends if not. */
export function checkToken(
  req: IncomingMessage,
  res: ServerResponse,
  expected: string,
): boolean {
  const got = req.headers['x-swayam-token'];
  if (typeof got === 'string' && got === expected) return true;
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('forbidden: missing or invalid x-swayam-token');
  return false;
}
