/**
 * Tool: gmail_send — send a previously-drafted email by draft id.
 * REQUIRES CONFIRMATION.
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'gmail_send',
  description:
    'Send a Gmail draft by id. This action is destructive and requires explicit user confirmation.',
  schema: {
    type: 'object',
    properties: { draft_id: { type: 'string' } },
    required: ['draft_id'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const id = String(args.draft_id ?? '');
    if (!id) return { text: 'gmail_send: missing draft_id' };
    try {
      const out = await gog(['gmail', 'send', '--draft-id', id]);
      return { text: out.trim() || 'sent.', data: { draft_id: id } };
    } catch (err) {
      if (err instanceof GogError) return { text: `gmail_send failed: ${err.message}\n${err.stderr}` };
      throw err;
    }
  },
};

export default tool;
