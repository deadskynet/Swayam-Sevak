/**
 * Tool: gmail_search — search Gmail via gogcli.
 *
 * Expected gogcli surface (subject to gog version):
 *   gog gmail search --json --max <N> -- "<query>"
 *
 * Output is parsed as JSON; if the user's gog returns a different shape, the
 * tool surfaces the raw stdout so the user can adjust.
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'gmail_search',
  description:
    'Search the user\'s Gmail. Accepts a Gmail-style query (e.g. "from:alice newer_than:7d"). Returns matching message metadata.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      max: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    required: ['query'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH. Set GOG_BIN in .env.',
  async execute(args) {
    const query = String(args.query ?? '');
    const max = Number(args.max ?? 20);
    try {
      const out = await gog(['gmail', 'search', '--json', '--max', String(max), '--', query]);
      return { text: out.trim() || '(no results)', data: { raw: out } };
    } catch (err) {
      if (err instanceof GogError) {
        return { text: `gmail_search failed: ${err.message}\nstderr:\n${err.stderr}` };
      }
      throw err;
    }
  },
};

export default tool;
