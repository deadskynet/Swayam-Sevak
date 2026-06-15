/**
 * Tool: gmail_read — fetch a Gmail THREAD by its id, including all messages.
 *
 * `gmail_search` returns thread ids (not message ids), so this tool reads
 * threads — which is what the LLM almost always wants anyway since email
 * conversations are threaded.
 *
 * gogcli surface (v0.27):
 *   gog gmail thread get <threadId> --full --sanitize-content --json
 *
 * `--sanitize-content` strips hostile HTML/CSS and removes URLs from
 * agent-consumed text — the gogcli docs strongly recommend it.
 */
import type { Tool } from './types.js';
import { gog, gogAvailable, GogError } from '../integrations/gogcli.js';

const tool: Tool = {
  name: 'gmail_read',
  description:
    'Fetch a Gmail thread (the unit returned by gmail_search) including all messages, sanitized for safe agent consumption. Pass the `id` field from a gmail_search result.',
  schema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Thread id (e.g. "19ecbe0a7c3fcf12") from a gmail_search result.' } },
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
      const out = await gog([
        'gmail', 'thread', 'get', id,
        '--full', '--sanitize-content', '--json',
      ]);
      return { text: out.trim(), data: { thread_id: id } };
    } catch (err) {
      if (err instanceof GogError) {
        return { text: `gmail_read failed: ${err.message}\n${err.stderr}` };
      }
      throw err;
    }
  },
};

export default tool;
