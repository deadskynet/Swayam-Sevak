/**
 * GET /api/sessions          — list session JSONL files
 * GET /api/sessions?id=…     — events from one session
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { json, type RouteHandler } from './_helpers.js';
import { paths } from '../../config/paths.js';
import { readText } from '../../util/fs.js';

export const sessionsList: RouteHandler = async (_req, res, url) => {
  const id = url.searchParams.get('id');
  if (id) return sessionDetail(id, res);

  const entries = await readdir(paths.sessionsDir).catch(() => []);
  const items = entries
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .slice(0, 100)
    .map((f) => ({ id: f.replace(/\.jsonl$/, '') }));
  json(res, 200, { sessions: items });
};

async function sessionDetail(id: string, res: import('node:http').ServerResponse): Promise<void> {
  if (id.includes('/') || id.includes('..')) {
    return json(res, 400, { error: 'invalid id' });
  }
  const file = join(paths.sessionsDir, `${id}.jsonl`);
  const text = await readText(file, '');
  if (!text) return json(res, 404, { error: 'session not found' });
  const events = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try { return JSON.parse(l); } catch { return { invalid: l }; }
    });
  json(res, 200, { id, events });
}
