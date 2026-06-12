/**
 * Tool: calendar_events — list upcoming or recent calendar events.
 *   gog calendar events --json --from <iso> --to <iso>
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'calendar_events',
  description:
    'List calendar events between two ISO timestamps. If no range is given, returns events from today through 7 days ahead.',
  schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'ISO 8601 start time (inclusive).' },
      to: { type: 'string', description: 'ISO 8601 end time (exclusive).' },
    },
    additionalProperties: false,
  },
  requiresConfirmation: false,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const defaultTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const from = String(args.from ?? defaultFrom);
    const to = String(args.to ?? defaultTo);
    try {
      const out = await gog(['calendar', 'events', '--json', '--from', from, '--to', to]);
      return { text: out.trim() || '(no events)', data: { from, to } };
    } catch (err) {
      if (err instanceof GogError) return { text: `calendar_events failed: ${err.message}\n${err.stderr}` };
      throw err;
    }
  },
};

export default tool;
