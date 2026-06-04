/**
 * Loads the assistant's static configuration: env vars + the five user-editable
 * markdown files in `config/`.
 *
 * The markdown files are returned as raw strings — the context builder splices
 * them into the system prompt verbatim, so the user retains full control over
 * tone and constraints.
 */
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { paths } from './paths.js';
import { join } from 'node:path';

loadDotenv({ path: join(paths.repoRoot, '.env') });

export type ProviderName = 'anthropic' | 'huggingface' | 'echo';

export interface RuntimeConfig {
  provider: ProviderName;
  anthropic: { apiKey: string; model: string };
  huggingface: { token: string; model: string };
  telegram: { botToken: string; allowedUserId: string | null };
  gog: { bin: string };
}

export interface PersonalityFiles {
  soul: string;
  identity: string;
  agents: string;
  tools: string;
  user: string;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const provider = (process.env.SWAYAM_PROVIDER ?? 'echo') as ProviderName;
  if (!['anthropic', 'huggingface', 'echo'].includes(provider)) {
    throw new Error(
      `SWAYAM_PROVIDER must be one of: anthropic, huggingface, echo. Got: ${provider}`,
    );
  }
  return {
    provider,
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-latest',
    },
    huggingface: {
      token: process.env.HF_TOKEN ?? '',
      model: process.env.HF_MODEL ?? 'meta-llama/Llama-3.1-8B-Instruct',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
      allowedUserId: process.env.TELEGRAM_ALLOWED_USER_ID ?? null,
    },
    gog: { bin: process.env.GOG_BIN ?? 'gog' },
  };
}

async function readIfExists(path: string): Promise<string> {
  try {
    await access(path, constants.F_OK);
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Loads the five personality markdown files from `config/`. Missing files
 * return empty strings — the assistant degrades gracefully rather than
 * crashing if the user has deleted (e.g.) USER.md.
 */
export async function loadPersonalityFiles(): Promise<PersonalityFiles> {
  const [soul, identity, agents, tools, user] = await Promise.all([
    readIfExists(join(paths.configDir, 'SOUL.md')),
    readIfExists(join(paths.configDir, 'IDENTITY.md')),
    readIfExists(join(paths.configDir, 'AGENTS.md')),
    readIfExists(join(paths.configDir, 'TOOLS.md')),
    readIfExists(join(paths.configDir, 'USER.md')),
  ]);
  return { soul, identity, agents, tools, user };
}
