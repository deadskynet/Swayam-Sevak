/**
 * Tool: schedule_create — create an automation from a natural-language description.
 *
 * The tool parses the description into (cron, action) using the LLM. The
 * `action` portion comes from the description: any segment matching
 * "send me my briefing" → action="briefing", "weekly review" → "weekly",
 * etc. For anything else, the action defaults to a single-shot `ask`.
 */
import type { Tool } from './types.js';
import { nlToCron } from '../scheduler/nl-to-cron.js';
import { addSchedule } from '../scheduler/scheduler.js';
import { loadRuntimeConfig } from '../config/load.js';
import { makeProvider } from '../llm/registry.js';

const ACTION_RULES: Array<{ re: RegExp; action: string }> = [
  { re: /\bweekly\s+review\b/i, action: 'weekly' },
  { re: /\bbriefing\b/i, action: 'briefing' },
  { re: /\bagenda\b/i, action: 'briefing' },
  { re: /\bdistill\b/i, action: 'memory distill' },
];

const tool: Tool = {
  name: 'schedule_create',
  description:
    'Create a recurring automation from a natural-language description, e.g. "every weekday at 9 AM send me my briefing". Requires confirmation.',
  schema: {
    type: 'object',
    properties: { description: { type: 'string' } },
    required: ['description'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  async execute(args) {
    const description = String(args.description ?? '').trim();
    if (!description) return { text: 'schedule_create: empty description' };

    const cfg = loadRuntimeConfig();
    const provider = makeProvider(cfg);
    const r = await nlToCron(provider, description);
    if (!r.ok) {
      return { text: `could not parse schedule: ${r.error}\nmodel said: ${r.reply ?? '(none)'}` };
    }
    const action =
      ACTION_RULES.find((rule) => rule.re.test(description))?.action ?? `ask '${description}'`;

    const created = await addSchedule({ description, cron: r.cron, action });
    return {
      text:
        `scheduled.\n  id:     ${created.id}\n  cron:   ${created.cron}\n  action: ${created.action}\n` +
        `note: schedules only run while a long-running swayam process (telegram start, etc.) is up.`,
      data: created,
    };
  },
};

export default tool;
