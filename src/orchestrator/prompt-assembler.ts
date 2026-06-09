/**
 * Prompt assembler — turns a `BuiltContext` into a system prompt string.
 *
 * Ordering is deterministic and documented here so the user can reason about
 * what the LLM sees. Earlier sections take precedence in case of conflict.
 *
 *   1. IDENTITY — who the assistant is
 *   2. SOUL — values, tone, hard constraints
 *   3. AGENTS — operating procedures, confirmation rules
 *   4. TOOLS — tool catalog (descriptive only; the actual schemas are passed
 *              through the provider's tool API or HF emulation envelope)
 *   5. USER — default profile + workspace overlay
 *   6. WORKSPACE — current workspace name and memory
 *   7. GLOBAL MEMORY — distilled cross-workspace facts
 *   8. RECENT DAILY LOGS — last few days of activity
 *   9. RECALLED MEMORY — query-targeted hits (if any)
 */
import type { BuiltContext } from './context-builder.js';

export function assembleSystemPrompt(ctx: BuiltContext): string {
  const blocks: string[] = [];

  push(blocks, 'IDENTITY', ctx.personality.identity);
  push(blocks, 'SOUL (personality, values, constraints)', ctx.personality.soul);
  push(blocks, 'AGENTS (operating procedures)', ctx.personality.agents);
  push(blocks, 'TOOLS (available tools — descriptive)', ctx.personality.tools);

  let userBlock = ctx.personality.user;
  if (ctx.workspaceUserOverlay) {
    userBlock = `${userBlock}\n\n---\n## Workspace overlay (${ctx.workspace})\n\n${ctx.workspaceUserOverlay}`;
  }
  push(blocks, 'USER', userBlock);

  push(
    blocks,
    `WORKSPACE: ${ctx.workspace}`,
    ctx.workspaceMemory,
  );

  push(blocks, 'GLOBAL MEMORY', ctx.globalMemory);

  if (ctx.recentDailyLogs.length) {
    const body = ctx.recentDailyLogs
      .map((l) => `### ${l.name}\n${l.content.trim()}`)
      .join('\n\n');
    push(blocks, 'RECENT DAILY LOGS', body);
  }

  if (ctx.recallHits.length) {
    const body = ctx.recallHits
      .map((h) => `### ${h.source}\n${h.text}`)
      .join('\n\n');
    push(blocks, 'RECALLED MEMORY (matched against the user query)', body);
  }

  return blocks.join('\n\n');
}

function push(blocks: string[], heading: string, body: string): void {
  if (!body || !body.trim()) return;
  blocks.push(`# ${heading}\n\n${body.trim()}`);
}
