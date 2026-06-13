/**
 * Tool: meeting_prep — given a calendar event, gather related context.
 *
 * For a given event (passed in by id or by query), this tool:
 *   1. fetches the event details (calendar_events for the day, then matches)
 *   2. searches gmail for the attendees and the title
 *   3. searches docs and memory for the title + attendees
 *   4. returns a structured prep summary as text
 *
 * It does NOT call the LLM — it returns the raw aggregation. The orchestrator's
 * model then synthesizes a briefing from this output. That keeps the tool
 * deterministic and inspectable.
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';
import { searchIndex } from '../docs/store.js';
import { recall } from '../memory/recall.js';

const tool: Tool = {
  name: 'meeting_prep',
  description:
    'Aggregate context for a meeting: related emails, ingested documents, and memory entries. Pass either a calendar event id or a freeform `query` (title or attendee).',
  schema: {
    type: 'object',
    properties: {
      event_id: { type: 'string' },
      query: { type: 'string' },
    },
    additionalProperties: false,
  },
  requiresConfirmation: false,
  async execute(args, ctx) {
    const sections: string[] = [];

    let query = args.query ? String(args.query) : '';
    if (args.event_id && (await gogAvailable())) {
      try {
        const out = await gog(['calendar', 'get', '--id', String(args.event_id), '--json']);
        sections.push(`## Event details\n${out.trim()}`);
        // Best-effort: pull the title from the JSON to seed the search.
        try {
          const parsed = JSON.parse(out) as { title?: string; summary?: string };
          query = query || parsed.title || parsed.summary || query;
        } catch { /* leave query as-is */ }
      } catch (err) {
        if (err instanceof GogError) sections.push(`## Event details\n(gog error: ${err.message})`);
      }
    }
    if (!query) return { text: 'meeting_prep: provide event_id or query.' };

    // Gmail.
    if (await gogAvailable()) {
      try {
        const out = await gog(['gmail', 'search', '--json', '--max', '10', '--', query], {
          timeout: 15000,
        });
        sections.push(`## Related emails (gmail)\n${out.trim() || '(none)'}`);
      } catch (err) {
        if (err instanceof GogError) sections.push(`## Related emails (gmail)\n(gog error: ${err.message})`);
      }
    } else {
      sections.push('## Related emails\n(gog not available)');
    }

    // Documents.
    const docs = await searchIndex(ctx.workspace, query, 5);
    if (docs.length) {
      const lines = docs.map(
        (d) => `- ${d.path} (chunk ${d.idx}, score ${d.score.toFixed(3)})\n  ${d.text.slice(0, 240)}…`,
      );
      sections.push(`## Related documents\n${lines.join('\n')}`);
    } else {
      sections.push('## Related documents\n(none)');
    }

    // Memory.
    const hits = await recall({ workspace: ctx.workspace, query, limit: 5 });
    if (hits.length) {
      const lines = hits.map((h) => `- [${h.source}] (score ${h.score})\n  ${h.text.split('\n')[0]}`);
      sections.push(`## Related memory\n${lines.join('\n')}`);
    } else {
      sections.push('## Related memory\n(none)');
    }

    return { text: sections.join('\n\n') };
  },
};

export default tool;
