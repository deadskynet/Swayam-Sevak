/**
 * `swayam daemon start` — long-running parent process.
 *
 * Boots the scheduler so cron entries fire while the daemon is up. If the
 * Telegram bot token is configured, it boots that too so messages come
 * through the same orchestrator. Otherwise it runs scheduler-only.
 *
 * launchd / systemd should call:
 *   swayam daemon start
 * (which is what `scripts/launchd/install.sh` configures via the plist).
 */
import { bootstrap } from './bootstrap.js';
import { startScheduler, loadSchedules } from '../scheduler/scheduler.js';
import { startTelegramBot } from '../integrations/telegram.js';
import { logger } from '../util/logger.js';

export async function runDaemonStart(): Promise<void> {
  const { cfg, orchestrator, workspace, provider } = await bootstrap();

  console.error(
    `swayam daemon starting [provider=${provider.name}] [workspace=${workspace}]`,
  );

  const schedules = await loadSchedules();
  console.error(`  schedules: ${schedules.length}`);
  const stopSched = await startScheduler();

  let stopBot: (() => Promise<void>) | (() => void) = () => {};
  if (cfg.telegram.botToken) {
    console.error('  telegram: starting bot');
    stopBot = await startTelegramBot({
      token: cfg.telegram.botToken,
      allowedUserId: cfg.telegram.allowedUserId,
      orchestrator,
    });
  } else {
    console.error('  telegram: disabled (TELEGRAM_BOT_TOKEN not set)');
  }

  const cleanup = async () => {
    console.error('\nshutting down ...');
    try { stopSched(); } catch (err) { logger.error('daemon', 'sched stop', { err: String(err) }); }
    try { await stopBot(); } catch (err) { logger.error('daemon', 'bot stop', { err: String(err) }); }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  console.error('\nrunning. Ctrl-C to stop.');
  await new Promise(() => { /* keep alive */ });
}
