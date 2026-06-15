/**
 * Tool: gmail_draft — create a draft (does NOT send).
 *
 * gogcli surface (v0.27):
 *   gog gmail drafts create --to <to> --subject <s> --body-stdin
 *
 * Returns the draft id. Use gmail_send to send it.
 */
import type { Tool } from './types.js';
import { execFile } from 'node:child_process';
import { gogAvailable } from '../integrations/gogcli.js';
import { loadRuntimeConfig } from '../config/load.js';

const tool: Tool = {
  name: 'gmail_draft',
  description:
    'Create a Gmail draft (does NOT send). Returns the draft id. Use gmail_send to actually send it.',
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
    const cliArgs = ['gmail', 'drafts', 'create', '--to', to, '--subject', subject, '--body-stdin', '--json'];
    if (cc) cliArgs.splice(3, 0, '--cc', cc);

    return new Promise((resolve) => {
      const child = execFile(cfg.gog.bin, cliArgs, { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            resolve({ text: `gmail_draft failed: ${err.message}\n${stderr}` });
          } else {
            resolve({ text: stdout.trim(), data: { to, subject } });
          }
        });
      child.stdin?.write(body);
      child.stdin?.end();
    });
  },
};

export default tool;
