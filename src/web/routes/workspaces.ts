/**
 * GET  /api/workspaces       — list all + active
 * POST /api/workspaces/use   — { name } switch active
 */
import { json, readJsonBody, checkToken, type RouteHandler } from './_helpers.js';
import {
  listWorkspaces,
  setActiveWorkspace,
  createWorkspace,
} from '../../memory/workspace.js';

export const workspacesList: RouteHandler = async (_req, res, _url, ctx) => {
  const all = await listWorkspaces();
  json(res, 200, { workspaces: all, active: ctx.workspace() });
};

export const workspacesUse: RouteHandler = async (req, res, _url, ctx) => {
  if (!checkToken(req, res, ctx.token)) return;
  const body = await readJsonBody<{ name?: string }>(req);
  if (!body.name) return json(res, 400, { error: 'missing name' });
  const all = await listWorkspaces();
  if (!all.includes(body.name)) {
    return json(res, 404, { error: `workspace "${body.name}" does not exist` });
  }
  await setActiveWorkspace(body.name);
  ctx.setWorkspace(body.name);
  json(res, 200, { active: body.name });
};

export const workspacesCreate: RouteHandler = async (req, res, _url, ctx) => {
  if (!checkToken(req, res, ctx.token)) return;
  const body = await readJsonBody<{ name?: string }>(req);
  if (!body.name) return json(res, 400, { error: 'missing name' });
  try {
    await createWorkspace(body.name);
    json(res, 200, { created: body.name });
  } catch (err) {
    json(res, 400, { error: (err as Error).message });
  }
};
