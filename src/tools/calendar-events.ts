/**
 * Tool: calendar_events — list calendar events.
 *
 * gogcli surface (v0.27):
 *   gog calendar events --today --json
 *   gog calendar events --from <iso> --to <iso> --json
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'calendar_events',
  description:
    'List calendar events. Pass `today: true` for today\'s events, or a from/to ISO range.',
  schema: {
    type: 'object',
    properties: {
      today: { type: 'boolean' },
      from: { type: 'string', description: 'ISO 8601 start time.' },
      to:   { type: 'string', description: 'ISO 8601 end time.' },
    },
    additionalProperties: false,
  },
  requiresConfirmation: false,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const cliArgs: string[] = ['calendar', 'events', '--json'];
    if (args.today === true) {
      cliArgs.push('--today');
    } else {
      const now = new Date();
      const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const defaultTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const from = String(args.from ?? defaultFrom);
      const to = String(args.to ?? defaultTo);
      cliArgs.push('--from', from, '--to', to);
    }
    try {
      const out = await gog(cliArgs);
      return { text: out.trim() || '(no events)', data: { args: cliArgs } };
    } catch (err) {
      if (err instanceof GogError) return { text: `calendar_events failed: ${err.message}\n${err.stderr}` };
      throw err;
    }
  },
};

export default tool;
