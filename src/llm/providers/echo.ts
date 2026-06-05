/**
 * Echo provider — deterministic, offline, used in tests and as the default
 * before the user configures a real provider.
 *
 * Behavior:
 *   - If the last user message starts with "tool:<name> {...json...}", echo
 *     produces a tool call request for that tool. Allows orchestrator tests
 *     to exercise the tool loop.
 *   - Otherwise echoes the last user message back, prefixed with [echo].
 */
import type { LLMProvider, CompleteParams, CompleteResult, ToolCallRequest } from '../types.js';

const TOOL_PREFIX = /^tool:(\w+)\s+(\{[\s\S]*\})\s*$/;

export class EchoProvider implements LLMProvider {
  readonly name = 'echo';

  async complete(params: CompleteParams): Promise<CompleteResult> {
    // If the previous assistant turn already issued a tool call, the next
    // iteration must NOT re-issue — otherwise we loop forever. We detect that
    // by looking at the last non-tool message: if it's an assistant turn with
    // tool calls, we just summarize the tool result.
    const lastNonTool = [...params.messages]
      .reverse()
      .find((m) => m.role !== 'tool');
    if (lastNonTool?.role === 'assistant' && lastNonTool.toolCalls?.length) {
      const toolMsgs = params.messages.filter((m) => m.role === 'tool');
      const lastTool = toolMsgs[toolMsgs.length - 1];
      return {
        text: `[echo] tool ${lastTool?.toolName ?? '?'} returned: ${lastTool?.content ?? ''}`,
        toolCalls: [],
        meta: { provider: 'echo', model: 'echo' },
      };
    }

    const last = [...params.messages].reverse().find((m) => m.role === 'user');
    const text = last?.content ?? '';
    const match = text.match(TOOL_PREFIX);
    if (match) {
      const [, toolName, jsonArgs] = match;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(jsonArgs!); } catch { /* keep empty */ }
      const call: ToolCallRequest = {
        id: `echo-${Date.now()}`,
        name: toolName!,
        arguments: args,
      };
      return {
        text: '',
        toolCalls: [call],
        meta: { provider: 'echo', model: 'echo' },
      };
    }
    return {
      text: `[echo] ${text}`,
      toolCalls: [],
      meta: { provider: 'echo', model: 'echo' },
    };
  }
}
