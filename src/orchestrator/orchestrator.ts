/**
 * Orchestrator — the single intelligent loop.
 *
 *   1. Build context (personality + memory + workspace + tools).
 *   2. Assemble system prompt.
 *   3. Call the LLM provider with the running message history.
 *   4. If the reply contains tool calls, dispatch them through the router and
 *      append the results as `tool` messages, then loop. Bounded by
 *      MAX_TOOL_ITERATIONS so a misbehaving model can't run forever.
 *   5. Otherwise, return the final reply.
 *
 * Confirmation flow: if a tool requires confirmation, the dispatcher returns
 * a placeholder result describing what would happen. The reply text from that
 * iteration becomes the assistant's "I'd like to do X — should I proceed?"
 * message; the next user message determines whether to re-issue with
 * `confirmed: true`.
 *
 * For v1, confirmations are interactive — the orchestrator yields back to the
 * caller (CLI or Telegram) with a `pendingConfirmation` payload, and the
 * caller hands it back when the user types "yes".
 */
import type { LLMProvider, ChatMessage, ToolCallRequest } from '../llm/types.js';
import type { Tool, ToolContext } from '../tools/types.js';
import { toToolSpec } from '../tools/types.js';
import { ToolRouter } from './tool-router.js';
import { buildContext } from './context-builder.js';
import { assembleSystemPrompt } from './prompt-assembler.js';
import { logger, newSessionId, setSession } from '../util/logger.js';
import { appendDailyLog } from '../memory/daily-log.js';
import { paths } from '../config/paths.js';
import { join } from 'node:path';

export const MAX_TOOL_ITERATIONS = 8;

export interface OrchestratorOptions {
  provider: LLMProvider;
  tools: Tool[];
  workspace: string;
  /** When set, reuse an existing session id for the explainability trace. */
  sessionId?: string;
}

export interface RunOptions {
  /** Pre-existing message history (for chat REPL turns). */
  history?: ChatMessage[];
  /** New user input for this turn. */
  userMessage: string;
  /** If true, allow tools that require confirmation to execute. */
  approvedToolCallIds?: Set<string>;
}

export interface RunResult {
  reply: string;
  history: ChatMessage[];
  /** True if at least one tool was actually executed in this turn. */
  toolsExecuted: number;
  /** Tool calls that were blocked pending confirmation. */
  pendingConfirmations: ToolCallRequest[];
  trace: {
    sessionId: string;
    sources: string[];
    toolEvents: Array<{ name: string; arguments: unknown; result?: string }>;
  };
}

export class Orchestrator {
  private provider: LLMProvider;
  private tools: Tool[];
  private router: ToolRouter;
  private workspace: string;
  private sessionId: string;

  constructor(opts: OrchestratorOptions) {
    this.provider = opts.provider;
    this.tools = opts.tools;
    this.router = new ToolRouter(opts.tools);
    this.workspace = opts.workspace;
    this.sessionId = opts.sessionId ?? newSessionId();
    setSession(this.sessionId);
  }

  get id(): string {
    return this.sessionId;
  }

  async run(opts: RunOptions): Promise<RunResult> {
    const approved = opts.approvedToolCallIds ?? new Set<string>();

    // 1. Build context from the user's message (used for memory recall).
    const ctx = await buildContext({
      workspace: this.workspace,
      tools: this.tools,
      query: opts.userMessage,
    });
    const system = assembleSystemPrompt(ctx);
    logger.info('context', 'built', {
      sources: ctx.trace.sources,
      systemLen: system.length,
    });

    // 2. Initialize message history for this turn.
    const history: ChatMessage[] = [
      ...(opts.history ?? []),
      { role: 'user', content: opts.userMessage },
    ];

    const toolCtx: ToolContext = {
      workspace: this.workspace,
      workspaceDir: join(paths.workspacesDir, this.workspace),
    };

    const toolSpecs = ctx.tools.map(toToolSpec);
    const pendingConfirmations: ToolCallRequest[] = [];
    const toolEvents: RunResult['trace']['toolEvents'] = [];
    let toolsExecuted = 0;

    // 3. Tool loop, bounded.
    let finalReply = '';
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await this.provider.complete({
        system,
        messages: history,
        tools: toolSpecs,
      });
      logger.info('llm', `${result.meta.provider}/${result.meta.model}`, {
        text_len: result.text.length,
        toolCalls: result.toolCalls.length,
      });

      // Append the assistant turn (text + any tool calls).
      history.push({
        role: 'assistant',
        content: result.text,
        toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
      });

      if (result.toolCalls.length === 0) {
        finalReply = result.text;
        break;
      }

      // Dispatch each tool call.
      for (const call of result.toolCalls) {
        const confirmed = approved.has(call.id) || !this.router.needsConfirmation(call.name);
        if (this.router.needsConfirmation(call.name) && !confirmed) {
          pendingConfirmations.push(call);
          history.push({
            role: 'tool',
            content:
              `confirmation pending for ${call.name}; ask the user, then re-issue.`,
            toolCallId: call.id,
            toolName: call.name,
          });
          toolEvents.push({
            name: call.name,
            arguments: call.arguments,
            result: 'pending-confirmation',
          });
          continue;
        }
        const toolResult = await this.router.dispatch(call, toolCtx, { confirmed });
        history.push({
          role: 'tool',
          content: toolResult.text,
          toolCallId: call.id,
          toolName: call.name,
        });
        toolEvents.push({
          name: call.name,
          arguments: call.arguments,
          result: toolResult.text.slice(0, 500),
        });
        toolsExecuted++;
      }

      // If everything was a pending confirmation, stop and surface the
      // assistant's request rather than looping.
      if (pendingConfirmations.length && !toolsExecuted) {
        finalReply =
          result.text ||
          `I'd like to call ${pendingConfirmations
            .map((c) => `\`${c.name}\``)
            .join(', ')}. Please confirm.`;
        break;
      }
    }

    if (!finalReply) {
      finalReply =
        'I reached the maximum tool iteration limit before producing a final reply. ' +
        'This usually means a tool kept failing or the model kept asking for one. ' +
        'Inspect the session trace.';
      logger.warn('orchestrator', 'max iterations reached', { sessionId: this.sessionId });
    }

    // 4. Mirror the turn to the daily log for explainability.
    await appendDailyLog({
      ts: new Date(),
      source: 'chat',
      workspace: this.workspace,
      summary: opts.userMessage.slice(0, 120),
      details:
        `**user**: ${opts.userMessage}\n\n**assistant**: ${finalReply}\n` +
        (toolEvents.length
          ? `\n**tools**: ${toolEvents.map((e) => e.name).join(', ')}`
          : ''),
    });

    return {
      reply: finalReply,
      history,
      toolsExecuted,
      pendingConfirmations,
      trace: {
        sessionId: this.sessionId,
        sources: ctx.trace.sources,
        toolEvents,
      },
    };
  }
}
