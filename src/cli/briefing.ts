/**
 * `swayam briefing` and `swayam weekly`
 */
import { bootstrap } from './bootstrap.js';
import { composeDailyBriefing } from '../briefing/daily.js';
import { composeWeeklyReview } from '../briefing/weekly.js';

export async function runBriefing(): Promise<void> {
  const { provider, workspace } = await bootstrap();
  console.error(`composing briefing [provider=${provider.name}] [workspace=${workspace}] ...`);
  const text = await composeDailyBriefing({ provider, workspace });
  process.stdout.write(text + '\n');
}

export async function runWeekly(): Promise<void> {
  const { provider, workspace } = await bootstrap();
  console.error(`composing weekly review [provider=${provider.name}] [workspace=${workspace}] ...`);
  const text = await composeWeeklyReview({ provider, workspace });
  process.stdout.write(text + '\n');
}
