/**
 * Tool router — dispatches a `ToolCallRequest` to the right `Tool.execute`.
 *
 * Confirmation handling: tools with `requiresConfirmation: true` are rejected
 * here unless the caller has marked the call as "confirmed". The orchestrator
 * is responsible for getting that confirmation from the user (CLI prompt /
 * Telegram round-trip) before re-issuing the call.
 */
import type { Tool, ToolContext, ToolResult } from '../tools/types.js';
import type { ToolCallRequest } from '../llm/types.js';
import { logger } from '../util/logger.js';

export interface DispatchOptions {
  confirmed?: boolean;
}

export class ToolRouter {
  private byName = new Map<string, Tool>();

  constructor(tools: Tool[]) {
    for (const t of tools) this.byName.set(t.name, t);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  needsConfirmation(name: string): boolean {
    return this.byName.get(name)?.requiresConfirmation ?? false;
  }

  list(): Tool[] {
    return [...this.byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async dispatch(
    call: ToolCallRequest,
    ctx: ToolContext,
    opts: DispatchOptions = {},
  ): Promise<ToolResult> {
    const tool = this.byName.get(call.name);
    if (!tool) {
      const text = `error: unknown tool "${call.name}"`;
      logger.warn('tool', text, { args: call.arguments });
      return { text };
    }
    if (tool.requiresConfirmation && !opts.confirmed) {
      return {
        text:
          `confirmation required for tool "${call.name}". ` +
          `Re-issue with confirmation. Arguments: ${JSON.stringify(call.arguments)}`,
        data: { needsConfirmation: true, args: call.arguments },
      };
    }
    logger.info('tool', `execute ${call.name}`, { args: call.arguments });
    try {
      const result = await tool.execute(call.arguments, ctx);
      logger.info('tool', `done ${call.name}`, {
        textLen: result.text.length,
        hasData: !!result.data,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('tool', `failed ${call.name}`, { error: msg });
      return { text: `error from tool ${call.name}: ${msg}` };
    }
  }
}
