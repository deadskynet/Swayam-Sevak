/**
 * Tool: gmail_draft — create a draft (does NOT send).
 *   gog gmail draft --to <to> --subject <s> --body-stdin
 * Returns the draft id on success.
 */
import type { Tool } from './types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gogAvailable } from '../integrations/gogcli.js';
import { loadRuntimeConfig } from '../config/load.js';

const execFileP = promisify(execFile);

const tool: Tool = {
  name: 'gmail_draft',
  description:
    'Create a Gmail draft (does NOT send). Returns the draft id. Use gmail_send to send it.',
  schema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      cc: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['to', 'subject', 'body'],
    additionalProperties: false,
  },
  requiresConfirmation: false,
  disabled: () => gogAvailable().then((b) => !b),
  disabledReason: '`gog` binary not found on PATH.',
  async execute(args) {
    const cfg = loadRuntimeConfig();
    const to = String(args.to ?? '');
    const cc = args.cc ? String(args.cc) : undefined;
    const subject = String(args.subject ?? '');
    const body = String(args.body ?? '');
    const cliArgs = ['gmail', 'draft', '--to', to, '--subject', subject, '--body-stdin'];
    if (cc) cliArgs.splice(2, 0, '--cc', cc);
    try {
      const child = execFileP(cfg.gog.bin, cliArgs, {
        timeout: 30000,
        maxBuffer: 4 * 1024 * 1024,
      });
      // Pipe body via stdin.
      child.child.stdin?.write(body);
      child.child.stdin?.end();
      const { stdout } = await child;
      return { text: stdout.trim(), data: { to, subject } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { text: `gmail_draft failed: ${msg}` };
    }
  },
};

export default tool;
