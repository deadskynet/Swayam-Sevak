/**
 * POST /api/confirm — approve pending tool calls and continue the turn.
 *
 * Request body:
 *   { sessionId: string, callIds: string[] }
 *
 * Same SSE event shape as /api/chat.
 */
import { readJsonBody, checkToken, type RouteHandler } from './_helpers.js';
import { Orchestrator } from '../../orchestrator/orchestrator.js';
import { SSEStream } from '../sse.js';
import { getSession } from '../sessions-store.js';

const CHUNK_SIZE = 64;

export const confirmRoute: RouteHandler = async (req, res, _url, ctx) => {
  if (!checkToken(req, res, ctx.token)) return;
  const body = await readJsonBody<{ sessionId?: string; callIds?: string[] }>(req);
  const sessionId = body.sessionId ?? '';
  const callIds = body.callIds ?? [];
  if (!sessionId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'sessionId required' }));
    return;
  }

  const stream = new SSEStream(res);
  stream.send('start', { sessionId });
  try {
    const session = getSession(sessionId);
    const orch = new Orchestrator({
      provider: ctx.provider,
      tools: ctx.enabledTools,
      workspace: ctx.workspace(),
      sessionId,
    });
    const result = await orch.run({
      history: session.pendingHistory ?? session.history,
      userMessage: '(confirmed — please proceed)',
      approvedToolCallIds: new Set(callIds),
    });
    for (let i = 0; i < result.reply.length; i += CHUNK_SIZE) {
      stream.send('text', { chunk: result.reply.slice(i, i + CHUNK_SIZE) });
    }
    session.history = result.history;
    session.pendingConfirmations = result.pendingConfirmations;
    session.pendingHistory = result.pendingConfirmations.length ? result.history : undefined;
    if (result.pendingConfirmations.length) {
      stream.send('pending', { calls: result.pendingConfirmations });
    }
    stream.send('trace', {
      sessionId: result.trace.sessionId,
      sources: result.trace.sources,
      toolEvents: result.trace.toolEvents,
    });
    stream.send('done', {});
  } catch (err) {
    stream.send('error', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    stream.end();
  }
};
