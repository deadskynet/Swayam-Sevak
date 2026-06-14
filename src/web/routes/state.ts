/**
 * GET /api/state — what the UI shows in its header.
 */
import { json, type RouteHandler } from './_helpers.js';
import { snapshot } from '../../tools/registry.js';

export const stateRoute: RouteHandler = async (_req, res, _url, ctx) => {
  const snap = await snapshot(ctx.tools);
  json(res, 200, {
    workspace: ctx.workspace(),
    provider: ctx.provider.name,
    tools: {
      enabled: snap.enabled.map((t) => ({
        name: t.name,
        description: t.description,
        requiresConfirmation: t.requiresConfirmation,
      })),
      disabled: snap.disabled.map((d) => ({
        name: d.tool.name,
        reason: d.reason,
      })),
    },
  });
};
