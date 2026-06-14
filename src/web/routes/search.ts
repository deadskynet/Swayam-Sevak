/**
 * POST /api/search — unified search across memory, docs, gmail.
 */
import { json, readJsonBody, checkToken, type RouteHandler } from './_helpers.js';
import { unifiedSearch } from '../../search/unified.js';

export const searchRoute: RouteHandler = async (req, res, _url, ctx) => {
  if (!checkToken(req, res, ctx.token)) return;
  const body = await readJsonBody<{ query?: string; limit?: number }>(req);
  if (!body.query) return json(res, 400, { error: 'query required' });
  const r = await unifiedSearch({
    workspace: ctx.workspace(),
    query: body.query,
    limit: body.limit ?? 5,
  });
  json(res, 200, r);
};
