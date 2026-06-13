/**
 * `swayam telegram start` — long-running.
 *
 * Also boots the scheduler so cron entries fire while the bot is up.
 */
import { bootstrap } from './bootstrap.js';
import { startTelegramBot } from '../integrations/telegram.js';
import { startScheduler } from '../scheduler/scheduler.js';

export async function runTelegramStart(): Promise<void> {
  const { cfg, orchestrator, workspace, provider } = await bootstrap();
  if (!cfg.telegram.botToken) {
    console.error(
      'TELEGRAM_BOT_TOKEN is not set. Get a bot token from @BotFather and add it to .env.',
    );
    process.exit(1);
  }

  console.error(
    `telegram bot starting [provider=${provider.name}] [workspace=${workspace}] ...`,
  );
  const stopBot = await startTelegramBot({
    token: cfg.telegram.botToken,
    allowedUserId: cfg.telegram.allowedUserId,
    orchestrator,
  });
  const stopSched = await startScheduler();

  const cleanup = async () => {
    console.error('\nshutting down ...');
    stopSched();
    await stopBot();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep alive.
  await new Promise(() => { /* never resolve */ });
}
