/**
 * Picks the configured LLM provider. Throws a helpful error if the user
 * selected a provider whose credentials are missing.
 */
import type { LLMProvider } from './types.js';
import { EchoProvider } from './providers/echo.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { HuggingFaceProvider } from './providers/huggingface.js';
import type { RuntimeConfig } from '../config/load.js';

export function makeProvider(cfg: RuntimeConfig): LLMProvider {
  switch (cfg.provider) {
    case 'echo':
      return new EchoProvider();
    case 'anthropic':
      return new AnthropicProvider(cfg.anthropic);
    case 'huggingface':
      return new HuggingFaceProvider(cfg.huggingface);
    default: {
      const exhaustive: never = cfg.provider;
      throw new Error(`unknown provider: ${exhaustive}`);
    }
  }
}
