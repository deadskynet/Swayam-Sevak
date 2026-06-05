/**
 * Hugging Face Inference API provider.
 *
 * Uses the chat-completions-compatible endpoint:
 *   POST https://api-inference.huggingface.co/models/<model>/v1/chat/completions
 *
 * Note: HF's free chat models do not all support function calling natively. We
 * emulate tool use by instructing the model in the system prompt to emit a
 * specific JSON envelope `{"tool":"<name>","arguments":{...}}` on a single
 * line when it wants to call a tool. The provider parses that envelope out
 * of the reply and surfaces it as a `ToolCallRequest`.
 *
 * This emulation is good enough for v1 with capable models (Llama-3.1-8B+,
 * Qwen2.5-7B+). For smaller models, expect occasional misses — fall back to
 * the orchestrator's bounded loop.
 */
import type {
  LLMProvider,
  CompleteParams,
  CompleteResult,
  ToolCallRequest,
  ChatMessage,
} from '../types.js';

interface HFChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TOOL_ENVELOPE_RE = /\{[\s\S]*?"tool"\s*:\s*"([^"]+)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})[\s\S]*?\}/;

function buildToolInstructions(tools: NonNullable<CompleteParams['tools']>): string {
  if (!tools.length) return '';
  const lines = [
    '',
    '## Tool use',
    'When you need to call a tool, output ONLY a single-line JSON envelope on its own line:',
    '`{"tool":"<name>","arguments":{...}}`',
    'After the tool result is returned, continue the conversation normally. Available tools:',
    '',
  ];
  for (const t of tools) {
    lines.push(`- \`${t.name}\` — ${t.description}`);
    lines.push(`  schema: ${JSON.stringify(t.schema)}`);
  }
  return lines.join('\n');
}

function adaptMessages(messages: ChatMessage[]): HFChatMessage[] {
  // Tool results are folded into the next user message as plain text.
  const out: HFChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: `[tool result: ${m.toolName}]\n${m.content}`,
      });
    } else if (m.role === 'assistant') {
      let content = m.content ?? '';
      for (const tc of m.toolCalls ?? []) {
        content += `\n${JSON.stringify({ tool: tc.name, arguments: tc.arguments })}`;
      }
      out.push({ role: 'assistant', content });
    } else {
      out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}

export class HuggingFaceProvider implements LLMProvider {
  readonly name = 'huggingface';
  private token: string;
  private defaultModel: string;

  constructor(opts: { token: string; model: string }) {
    if (!opts.token) {
      throw new Error('HF_TOKEN is not set. Add it to .env or switch SWAYAM_PROVIDER.');
    }
    this.token = opts.token;
    this.defaultModel = opts.model;
  }

  async complete(params: CompleteParams): Promise<CompleteResult> {
    const model = params.model ?? this.defaultModel;
    const system = params.system + buildToolInstructions(params.tools ?? []);
    const body = {
      model,
      messages: [{ role: 'system', content: system }, ...adaptMessages(params.messages)],
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      stream: false,
    };
    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}/v1/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`HuggingFace ${resp.status} ${resp.statusText}: ${errBody.slice(0, 500)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content ?? '';
    const toolCalls = this.extractToolCalls(reply);
    // Strip the envelope from the visible text if present.
    const text = toolCalls.length ? reply.replace(TOOL_ENVELOPE_RE, '').trim() : reply;
    return { text, toolCalls, meta: { provider: 'huggingface', model } };
  }

  private extractToolCalls(reply: string): ToolCallRequest[] {
    const match = reply.match(TOOL_ENVELOPE_RE);
    if (!match) return [];
    try {
      const args = JSON.parse(match[2]!);
      return [{ id: `hf-${Date.now()}`, name: match[1]!, arguments: args }];
    } catch {
      return [];
    }
  }
}
