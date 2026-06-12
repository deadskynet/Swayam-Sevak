/**
 * Tool: gmail_read — fetch a specific email body by id.
 *   gog gmail get --id <id> --format full
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'gmail_read',
  description: 'Fetch the full content of a Gmail message by its id.',
  schema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const id = String(args.id ?? '');
    if (!id) return { text: 'gmail_read: missing id' };
    try {
      const out = await gog(['gmail', 'get', '--id', id, '--format', 'full']);
      return { text: out.trim(), data: { id } };
    } catch (err) {
      if (err instanceof GogError) {
        return { text: `gmail_read failed: ${err.message}\n${err.stderr}` };
      }
      throw err;
    }
  },
};

export default tool;
