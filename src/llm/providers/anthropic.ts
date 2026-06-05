/**
 * Anthropic provider — wraps the official SDK.
 *
 * Supports tool use via the Messages API. Tool results are fed back as
 * `tool_result` content blocks on a user message — handled in the message
 * adapter below.
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  CompleteParams,
  CompleteResult,
  ToolCallRequest,
  ChatMessage,
} from '../types.js';

interface AnthropicMsg {
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string }
  >;
}

function adaptMessages(messages: ChatMessage[]): AnthropicMsg[] {
  // Anthropic expects user/assistant alternation. Tool results travel inside
  // user messages; assistant tool calls travel inside assistant messages.
  const out: AnthropicMsg[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      // Append tool_result to the most recent user message, or create one.
      const last = out[out.length - 1];
      const block = {
        type: 'tool_result' as const,
        tool_use_id: m.toolCallId ?? '',
        content: m.content,
      };
      if (last && last.role === 'user') last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    } else if (m.role === 'assistant') {
      const blocks: AnthropicMsg['content'] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      }
      out.push({ role: 'assistant', content: blocks });
    } else {
      out.push({ role: 'user', content: [{ type: 'text', text: m.content }] });
    }
  }
  return out;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private defaultModel: string;

  constructor(opts: { apiKey: string; model: string }) {
    if (!opts.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env or switch SWAYAM_PROVIDER.');
    }
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.defaultModel = opts.model;
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    const model = params.model ?? this.defaultModel;
    const tools = (params.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema as Anthropic.Tool.InputSchema,
    }));
    const resp = await this.client.messages.create({
      model,
      system: params.system,
      messages: adaptMessages(params.messages) as Anthropic.MessageParam[],
      tools: tools.length ? tools : undefined,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
    });

    let text = '';
    const toolCalls: ToolCallRequest[] = [];
    for (const block of resp.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }
    return { text, toolCalls, meta: { provider: 'anthropic', model } };
  }
}
