/**
 * Tool: docs_search — semantic search over ingested documents.
 *
 * Uses TF-IDF for v1; the same interface remains when we swap in embeddings.
 */
import type { Tool } from './types.js';
import { searchIndex } from '../docs/store.js';

const tool: Tool = {
  name: 'docs_search',
  description:
    'Search documents that have been ingested into the active workspace. Returns the most relevant chunks with source paths.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
    },
    required: ['query'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  async execute(args, ctx) {
    const query = String(args.query ?? '');
    const limit = Number(args.limit ?? 5);
    const hits = await searchIndex(ctx.workspace, query, limit);
    if (!hits.length) return { text: 'No matching documents.', data: { hits: [] } };
    const text = hits
      .map(
        (h, i) =>
          `### ${i + 1}. ${h.path} (chunk ${h.idx}, score ${h.score.toFixed(3)})\n${h.text}`,
      )
      .join('\n\n');
    return { text, data: { hits } };
  },
};

export default tool;
