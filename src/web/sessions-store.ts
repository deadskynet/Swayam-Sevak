/**
 * Per-process map from web sessionId → orchestrator chat history.
 *
 * The browser issues a sessionId on first chat; the backend remembers the
 * `ChatMessage[]` so subsequent turns get full context. State is in-memory
 * only — restart wipes it. The orchestrator's own `data/sessions/<id>.jsonl`
 * trace is the durable record.
 */
import type { ChatMessage, ToolCallRequest } from '../llm/types.js';

interface WebSession {
  history: ChatMessage[];
  pendingConfirmations: ToolCallRequest[];
  pendingHistory?: ChatMessage[];
}

const store = new Map<string, WebSession>();

export function getSession(id: string): WebSession {
  let s = store.get(id);
  if (!s) {
    s = { history: [], pendingConfirmations: [] };
    store.set(id, s);
  }
  return s;
}

export function clearSession(id: string): void {
  store.delete(id);
}

export function listSessions(): string[] {
  return [...store.keys()];
}
