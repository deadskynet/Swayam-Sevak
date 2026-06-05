/**
 * LLM provider abstraction.
 *
 * The interface is deliberately narrow — `complete()` takes a system prompt,
 * a message history, and an optional tool set, and returns either a final
 * assistant message or a list of tool calls. The orchestrator keeps the loop
 * simple by polling this single function.
 *
 * Streaming is intentionally out of scope for v1 — we render the final reply
 * once it arrives. Adding streaming later means widening this interface; no
 * call sites change.
 */

export type Role = 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  /** Set on `assistant` messages that requested a tool call. */
  toolCalls?: ToolCallRequest[];
  /** Set on `tool` messages — the id of the call this is responding to. */
  toolCallId?: string;
  /** Set on `tool` messages — the name of the tool that produced this result. */
  toolName?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  schema: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompleteParams {
  system: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  /** Optional override; default is the provider's configured model. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  /** The textual reply (may be empty if the model only requested tools). */
  text: string;
  /** If non-empty, the orchestrator must execute these and feed results back. */
  toolCalls: ToolCallRequest[];
  /** Provider-specific metadata for explainability. */
  meta: { provider: string; model: string; raw?: unknown };
}

export interface LLMProvider {
  readonly name: string;
  complete(params: CompleteParams): Promise<CompleteResult>;
}
