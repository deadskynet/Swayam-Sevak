/**
 * GET /api/memory                — workspace + global MEMORY.md, recent logs list
 * GET /api/memory/log?date=…     — full content of one daily log
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { json, type RouteHandler } from './_helpers.js';
import { paths } from '../../config/paths.js';
import { readText } from '../../util/fs.js';
import {
  readGlobalMemory,
  readWorkspaceMemory,
} from '../../memory/long-term.js';

export const memoryRoot: RouteHandler = async (_req, res, _url, ctx) => {
  const workspace = ctx.workspace();
  const [workspaceMemory, globalMemory, logs] = await Promise.all([
    readWorkspaceMemory(workspace),
    readGlobalMemory(),
    listDailyLogs(),
  ]);
  json(res, 200, {
    workspace,
    workspaceMemory,
    globalMemory,
    logs, // array of { date, sizeBytes }
  });
};

export const memoryLog: RouteHandler = async (_req, res, url) => {
  const date = url.searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(res, 400, { error: 'invalid or missing date (YYYY-MM-DD)' });
  }
  const file = join(paths.memoryDir, `${date}.md`);
  const content = await readText(file, '');
  json(res, 200, { date, content });
};

async function listDailyLogs(): Promise<Array<{ date: string }>> {
  const entries = await readdir(paths.memoryDir).catch(() => []);
  return entries
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .map((f) => ({ date: f.replace(/\.md$/, '') }));
}
