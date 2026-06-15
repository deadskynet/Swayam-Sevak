/**
 * Tool: calendar_create — create a calendar event. REQUIRES CONFIRMATION.
 *
 * gogcli surface (v0.27):
 *   gog calendar create --summary <s> --from <iso> --to <iso>
 *                       [--location <s>] [--description <s>]
 *                       [--attendee <email>]...
 *                       [--with-meet]
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
      summary: { type: 'string', description: 'Event title.' },
      start: { type: 'string', description: 'ISO 8601 start (RFC3339, e.g. 2026-06-15T10:00:00+05:30).' },
      end:   { type: 'string', description: 'ISO 8601 end.' },
      description: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string' } },
      location: { type: 'string' },
      with_meet: { type: 'boolean', description: 'Auto-attach a Google Meet link.' },
    },
    required: ['summary', 'start', 'end'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const summary = String(args.summary ?? '');
    const start = String(args.start ?? '');
    const end = String(args.end ?? '');
    const description = args.description ? String(args.description) : '';
    const location = args.location ? String(args.location) : '';
    const attendees = Array.isArray(args.attendees) ? (args.attendees as string[]) : [];

    const cliArgs = ['calendar', 'create', '--summary', summary, '--from', start, '--to', end, '--json'];
    if (description) cliArgs.push('--description', description);
    if (location) cliArgs.push('--location', location);
    if (args.with_meet) cliArgs.push('--with-meet');
    for (const a of attendees) cliArgs.push('--attendee', a);
    try {
      const out = await gog(cliArgs);
      return { text: out.trim() || 'event created.', data: { summary, start, end } };
    } catch (err) {
      if (err instanceof GogError) return { text: `calendar_create failed: ${err.message}\n${err.stderr}` };
      throw err;
    }
  },
};

export default tool;
