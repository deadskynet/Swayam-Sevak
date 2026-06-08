/**
 * Tool: memory_search — search MEMORY.md and recent daily logs.
 */
import type { Tool } from './types.js';
import { recall } from '../memory/recall.js';

const tool: Tool = {
  name: 'memory_search',
  description:
    'Search the user\'s long-term memory and recent daily logs for content matching a natural-language query. Returns the top-K matching sections with their source labels.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language search query.' },
      limit: { type: 'integer', minimum: 1, maximum: 20, default: 6 },
    },
    required: ['query'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  async execute(args, ctx) {
    const query = String(args.query ?? '');
    const limit = Number(args.limit ?? 6);
    const hits = await recall({ query, workspace: ctx.workspace, limit });
    if (hits.length === 0) {
      return { text: 'No memory matched.', data: { hits: [] } };
    }
    const text = hits
      .map((h) => `### ${h.source} (score=${h.score})\n${h.text}`)
      .join('\n\n');
    return { text, data: { hits } };
  },
};

export default tool;
