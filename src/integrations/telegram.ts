/**
 * Telegram integration.
 *
 * Long-poll loop, single user (the brief explicitly says single-user). All
 * inbound messages are routed through the same orchestrator that powers the
 * CLI — Telegram is just another interface. Conversation history per chat is
 * kept in memory for the lifetime of the process; on restart we start fresh.
 *
 * Confirmations: tools with `requiresConfirmation` cannot be auto-executed
 * here in v1. The orchestrator returns its `pendingConfirmation` payload as
 * a normal reply ("I'd like to call X — reply 'yes' to proceed"). The next
 * inbound message that says "yes" / "y" is interpreted as approval; we then
 * re-issue the call.  ROADMAP notes proper inline-keyboard confirmations.
 */
import TelegramBot from 'node-telegram-bot-api';
import type { Orchestrator } from '../orchestrator/orchestrator.js';
import type { ChatMessage, ToolCallRequest } from '../llm/types.js';
import { logger } from '../util/logger.js';

const APPROVAL_RE = /^\s*(yes|y|approve|approved|go|do it)\s*[.!]?\s*$/i;

interface ChatState {
  history: ChatMessage[];
  pending: ToolCallRequest[];
  pendingHistory?: ChatMessage[];
}

export async function startTelegramBot(opts: {
  token: string;
  allowedUserId: string | null;
  orchestrator: Orchestrator;
}): Promise<() => void> {
  const bot = new TelegramBot(opts.token, { polling: true });
  const states = new Map<number, ChatState>();
  const allowed = opts.allowedUserId ? String(opts.allowedUserId) : null;

  bot.on('message', async (msg) => {
    const fromId = msg.from?.id ? String(msg.from.id) : '';
    const chatId = msg.chat.id;
    if (allowed && fromId !== allowed) {
      logger.warn('telegram', 'rejected unknown user', { fromId });
      await bot.sendMessage(chatId, 'sorry — this bot is configured for a single user.');
      return;
    }
    const text = msg.text ?? '';
    if (!text) return;

    let state = states.get(chatId);
    if (!state) {
      state = { history: [], pending: [] };
      states.set(chatId, state);
    }

    try {
      // Approval path.
      if (state.pending.length && APPROVAL_RE.test(text)) {
        const approved = new Set(state.pending.map((c) => c.id));
        const result = await opts.orchestrator.run({
          history: state.pendingHistory ?? state.history,
          userMessage: '(confirmed — please proceed)',
          approvedToolCallIds: approved,
        });
        state.history = result.history;
        state.pending = result.pendingConfirmations;
        state.pendingHistory = result.pendingConfirmations.length ? result.history : undefined;
        await bot.sendMessage(chatId, result.reply || '(empty reply)');
        return;
      }

      // Normal turn.
      const result = await opts.orchestrator.run({
        history: state.history,
        userMessage: text,
      });
      state.history = result.history;
      state.pending = result.pendingConfirmations;
      state.pendingHistory = result.pendingConfirmations.length ? result.history : undefined;

      let reply = result.reply || '(empty reply)';
      if (result.pendingConfirmations.length) {
        const calls = result.pendingConfirmations
          .map((c) => `- \`${c.name}\`(${JSON.stringify(c.arguments)})`)
          .join('\n');
        reply = `${reply}\n\nReply *yes* to approve:\n${calls}`;
      }
      await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      logger.error('telegram', 'turn failed', { error: m });
      await bot.sendMessage(chatId, `error: ${m}`);
    }
  });

  bot.on('polling_error', (err) => logger.error('telegram', 'polling_error', { error: err.message }));

  return async () => {
    await bot.stopPolling();
  };
}
