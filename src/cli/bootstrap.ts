/**
 * Shared CLI bootstrap — loads provider, tools, and the active workspace.
 *
 * Also surfaces first-time-user warnings: if the data dir hasn't been seeded
 * or the user is still on the offline echo provider, we tell them once per
 * process. Warnings go to stderr so they don't leak into command stdout.
 */
import { loadRuntimeConfig } from '../config/load.js';
import { makeProvider } from '../llm/registry.js';
import { loadTools, snapshot } from '../tools/registry.js';
import { getActiveWorkspace } from '../memory/workspace.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { paths } from '../config/paths.js';
import { pathExists } from '../util/fs.js';

export async function bootstrap() {
  await maybeWarnSetup();

  const cfg = loadRuntimeConfig();
  const provider = makeProvider(cfg);
  const tools = await loadTools();
  const snap = await snapshot(tools);
  const workspace = await getActiveWorkspace();
  const orchestrator = new Orchestrator({
    provider,
    tools: snap.enabled,
    workspace,
  });
  return { cfg, provider, workspace, orchestrator, snap };
}

let warned = false;

async function maybeWarnSetup(): Promise<void> {
  if (warned) return;
  warned = true;

  const seeded = await pathExists(paths.dataDir);
  if (!seeded) {
    console.error(
      '⚠️  data/ directory not found. Run `npm run seed` to initialize state.\n',
    );
  }

  const provider = (process.env.SWAYAM_PROVIDER ?? 'echo').toLowerCase();
  if (provider === 'echo') {
    console.error(
      '⚠️  SWAYAM_PROVIDER=echo (offline test provider).\n' +
        '    Set ANTHROPIC_API_KEY or HF_TOKEN in .env, then change SWAYAM_PROVIDER to use a real model.\n',
    );
  } else if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      '⚠️  SWAYAM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty.\n' +
        '    Add your key to .env (https://console.anthropic.com).\n',
    );
  } else if (provider === 'huggingface' && !process.env.HF_TOKEN) {
    console.error(
      '⚠️  SWAYAM_PROVIDER=huggingface but HF_TOKEN is empty.\n' +
        '    Add your token to .env (https://huggingface.co/settings/tokens).\n',
    );
  }
}
