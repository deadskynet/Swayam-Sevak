/**
 * Structured logger for explainability traces.
 *
 * Every meaningful action — context build, LLM call, tool dispatch, memory
 * write — emits a structured event. Events are:
 *   1. Printed to stderr for live observability.
 *   2. Appended to the active session's JSONL file under `data/sessions/`.
 *   3. Optionally mirrored to the daily log (orchestrator decides which).
 *
 * The session id is set per-conversation by the orchestrator. Use
 * `withSession()` to scope subsequent log calls to a session file.
 */
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { appendText } from './fs.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  ts: string;            // ISO timestamp
  level: LogLevel;
  scope: string;         // 'context' | 'llm' | 'tool' | 'memory' | 'cli' | ...
  message: string;
  data?: Record<string, unknown>;
  sessionId?: string;
}

let currentSessionId: string | null = null;
let debugEnabled = process.env.SWAYAM_DEBUG === '1';

export function setSession(id: string | null): void {
  currentSessionId = id;
}

export function setDebug(on: boolean): void {
  debugEnabled = on;
}

function shouldEmit(level: LogLevel): boolean {
  if (level === 'debug') return debugEnabled;
  return true;
}

async function persist(evt: LogEvent): Promise<void> {
  if (!evt.sessionId) return;
  const path = join(paths.sessionsDir, `${evt.sessionId}.jsonl`);
  try {
    await appendText(path, JSON.stringify(evt) + '\n');
  } catch {
    // Logging must never crash the main loop.
  }
}

export function log(
  level: LogLevel,
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldEmit(level)) return;
  const evt: LogEvent = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    data,
    sessionId: currentSessionId ?? undefined,
  };
  // stderr so it doesn't pollute CLI stdout (which carries the assistant reply).
  const tag = `[${evt.scope}]`;
  if (level === 'error') console.error(tag, message, data ?? '');
  else if (level === 'warn') console.error(tag, message, data ?? '');
  else if (debugEnabled) console.error(tag, message, data ?? '');
  void persist(evt);
}

export const logger = {
  debug: (scope: string, msg: string, data?: Record<string, unknown>) =>
    log('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: Record<string, unknown>) =>
    log('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: Record<string, unknown>) =>
    log('warn', scope, msg, data),
  error: (scope: string, msg: string, data?: Record<string, unknown>) =>
    log('error', scope, msg, data),
};

export function newSessionId(): string {
  // Time-ordered, human-readable, no external deps.
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${stamp}-${rand}`;
}
