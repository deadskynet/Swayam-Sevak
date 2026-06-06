/**
 * Returns the current local time. Useful for the LLM when scheduling or
 * answering "what day is it" questions without relying on training cutoff.
 *
 * Always available — no credentials, no external calls.
 */
import type { Tool } from './types.js';

const tool: Tool = {
  name: 'now',
  description: 'Returns the current date and time in ISO 8601 and a human-readable form.',
  schema: { type: 'object', properties: {}, additionalProperties: false },
  requiresConfirmation: false,
  async execute() {
    const d = new Date();
    return {
      text: `${d.toISOString()} (${d.toString()})`,
      data: { iso: d.toISOString(), epoch: d.getTime() },
    };
  },
};

export default tool;
