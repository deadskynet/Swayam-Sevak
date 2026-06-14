#!/usr/bin/env node
/**
 * swayam — CLI entry.
 *
 * Subcommands:
 *   chat                interactive chat REPL
 *   ask "<msg>"         single-shot question
 *   memory view         show recent memory + workspace memory
 *   memory distill      fold daily logs into MEMORY.md
 *   workspace list|use|create|new
 *   docs ingest <path>  index a document
 *   search "<query>"    unified search
 *   briefing            today's briefing
 *   weekly              weekly review
 *   schedule add|list|remove
 *   telegram start      run the bot
 *   tools               list available tools and which are disabled
 */
import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';
import { paths } from '../config/paths.js';
import { join } from 'node:path';

loadDotenv({ path: join(paths.repoRoot, '.env') });

import { runChat, runAsk } from './chat.js';
import { runBriefing, runWeekly } from './briefing.js';
import { runSearch } from './search.js';
import { runMemoryView, runMemoryDistill } from './memory.js';
import { runWorkspaceList, runWorkspaceUse, runWorkspaceCreate } from './workspace.js';
import { runDocsIngest } from './docs.js';
import { runScheduleAdd, runScheduleList, runScheduleRemove } from './schedule.js';
import { runTelegramStart } from './telegram.js';
import { runDaemonStart } from './daemon.js';
import { runToolsList } from './tools.js';

const program = new Command();
program
  .name('swayam')
  .description('Swayam-Sevak — your local personal AI operating system.')
  .version('0.1.0');

program
  .command('chat')
  .description('Interactive chat REPL.')
  .action(async () => { await runChat(); });

program
  .command('ask')
  .description('Single-shot question; prints reply and exits.')
  .argument('<message...>')
  .action(async (parts: string[]) => { await runAsk(parts.join(' ')); });

const memory = program.command('memory').description('Memory operations.');
memory.command('view').description('View memory files.').action(async () => { await runMemoryView(); });
memory
  .command('distill')
  .description('Fold recent daily logs into MEMORY.md.')
  .option('-d, --days <n>', 'how many days to distill', '7')
  .action(async (opts: { days: string }) => {
    await runMemoryDistill({ days: Number(opts.days) });
  });

const ws = program.command('workspace').description('Workspaces.');
ws.command('list').description('List workspaces.').action(async () => { await runWorkspaceList(); });
ws
  .command('use')
  .argument('<name>')
  .description('Switch active workspace.')
  .action(async (name: string) => { await runWorkspaceUse(name); });
ws
  .command('create')
  .argument('<name>')
  .description('Create a new workspace.')
  .action(async (name: string) => { await runWorkspaceCreate(name); });

const docs = program.command('docs').description('Document intelligence.');
docs
  .command('ingest')
  .argument('<path>', 'file or directory to ingest')
  .description('Index a document into the active workspace.')
  .action(async (p: string) => { await runDocsIngest(p); });

program
  .command('search')
  .argument('<query...>')
  .description('Unified search across memory, docs, and tools.')
  .action(async (parts: string[]) => { await runSearch(parts.join(' ')); });

program
  .command('briefing')
  .description('Generate today\'s briefing.')
  .action(async () => { await runBriefing(); });

program
  .command('weekly')
  .description('Generate the weekly review.')
  .action(async () => { await runWeekly(); });

const sched = program.command('schedule').description('Natural-language schedules.');
sched
  .command('add')
  .argument('<description...>')
  .description('Add a schedule from a natural-language description.')
  .action(async (parts: string[]) => { await runScheduleAdd(parts.join(' ')); });
sched.command('list').description('List schedules.').action(async () => { await runScheduleList(); });
sched
  .command('remove')
  .argument('<id>')
  .description('Remove a schedule by id.')
  .action(async (id: string) => { await runScheduleRemove(id); });

program
  .command('telegram')
  .description('Telegram bot.')
  .command('start')
  .description('Long-running bot that routes inbound messages through the orchestrator.')
  .action(async () => { await runTelegramStart(); });

const daemon = program.command('daemon').description('Long-running scheduler + telegram (if configured).');
daemon
  .command('start')
  .description('Start the daemon (scheduler + telegram bot if TELEGRAM_BOT_TOKEN is set).')
  .action(async () => { await runDaemonStart(); });

program
  .command('tools')
  .description('List available tools and credentials status.')
  .action(async () => { await runToolsList(); });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
