/**
 * Natural-language → cron expression.
 *
 * Asks the configured LLM provider to translate a free-form description
 * ("every weekday at 9 AM") into a 5-field cron expression. The result is
 * validated with `cron-parser` before being persisted; an invalid expression
 * is surfaced verbatim with the model's reply attached for transparency.
 */
import cronParser from 'cron-parser';
import type { LLMProvider } from '../llm/types.js';

const SYSTEM = `You are a strict NL-to-cron converter.

Given a natural-language description of a schedule, output exactly one line:
  CRON: <5-field cron expression>

Rules:
  - 5 fields only (minute hour day-of-month month day-of-week).
  - Use standard cron syntax: numbers, ranges, lists, steps, *.
  - All times are in the user's local timezone (assume that's what they mean).
  - For "every weekday" use 1-5 in the day-of-week field.
  - For "every N hours" use */N in the hour field.
  - If the input is ambiguous or impossible, output: ERROR: <reason>
  - Output NOTHING ELSE — no commentary, no markdown.`;

export async function nlToCron(
  provider: LLMProvider,
  description: string,
): Promise<{ ok: true; cron: string } | { ok: false; error: string; reply?: string }> {
  const result = await provider.complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    maxTokens: 64,
    temperature: 0,
  });
  const text = result.text.trim();
  const cronMatch = text.match(/^CRON:\s*(.+)$/m);
  if (!cronMatch) {
    const errMatch = text.match(/^ERROR:\s*(.+)$/m);
    return {
      ok: false,
      error: errMatch ? errMatch[1]! : 'model did not return a CRON line',
      reply: text,
    };
  }
  const cron = cronMatch[1]!.trim();
  try {
    cronParser.parseExpression(cron);
    return { ok: true, cron };
  } catch (err) {
    return {
      ok: false,
      error: `invalid cron "${cron}": ${(err as Error).message}`,
      reply: text,
    };
  }
}
