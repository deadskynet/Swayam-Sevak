/**
 * Tool: calendar_create — create a calendar event. REQUIRES CONFIRMATION.
 *   gog calendar create --title <s> --start <iso> --end <iso> [--attendees ...]
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'calendar_create',
  description:
    'Create a calendar event. Destructive — requires explicit user confirmation.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      start: { type: 'string', description: 'ISO 8601 start.' },
      end: { type: 'string', description: 'ISO 8601 end.' },
      description: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string' } },
      location: { type: 'string' },
    },
    required: ['title', 'start', 'end'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const title = String(args.title ?? '');
    const start = String(args.start ?? '');
    const end = String(args.end ?? '');
    const description = args.description ? String(args.description) : '';
    const location = args.location ? String(args.location) : '';
    const attendees = Array.isArray(args.attendees) ? (args.attendees as string[]) : [];
    const cliArgs = ['calendar', 'create', '--title', title, '--start', start, '--end', end];
    if (description) cliArgs.push('--description', description);
    if (location) cliArgs.push('--location', location);
    for (const a of attendees) cliArgs.push('--attendee', a);
    try {
      const out = await gog(cliArgs);
      return { text: out.trim() || 'event created.', data: { title, start, end } };
    } catch (err) {
      if (err instanceof GogError) return { text: `calendar_create failed: ${err.message}\n${err.stderr}` };
      throw err;
    }
  },
};

export default tool;
