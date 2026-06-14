/**
 * Chat tab.
 */
import { postSSE } from '../api.js';
import { renderMarkdown } from '../md.js';

interface PendingCall { id: string; name: string; arguments: unknown }

let sessionId: string | null = null;
let pending: PendingCall[] = [];

function newSessionId(): string {
  const t = new Date().toISOString().replace(/[:.]/g, '-');
  const r = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `web-${t}-${r}`;
}

export function initChat(): void {
  sessionId = newSessionId();
  const log = document.getElementById('chat-log')!;
  log.innerHTML = '';

  const form = document.getElementById('chat-form') as HTMLFormElement;
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const submit = form.querySelector('button')!;

  // Auto-resize textarea up to max-height.
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 240) + 'px';
  });

  // Ctrl+Enter to submit.
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    input.style.height = 'auto';

    addMessage('user', msg);
    submit.disabled = true;
    try {
      await streamTurn('/api/chat', { sessionId, message: msg });
    } catch (err) {
      addError(err instanceof Error ? err.message : String(err));
    } finally {
      submit.disabled = false;
    }
  });
}

async function streamTurn(path: string, body: unknown): Promise<void> {
  // Create the assistant bubble we'll stream into.
  const log = document.getElementById('chat-log')!;
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant';
  bubble.innerHTML = '<div class="msg-role">assistant</div><div class="msg-body"></div>';
  log.appendChild(bubble);
  const bodyEl = bubble.querySelector('.msg-body') as HTMLElement;
  log.scrollTop = log.scrollHeight;

  let acc = '';
  type Trace = { sources: string[]; toolEvents: Array<{ name: string }> };
  let trace: Trace | null = null;

  await postSSE(path, body, (evt) => {
    if (evt.event === 'text') {
      const data = evt.data as { chunk: string };
      acc += data.chunk;
      bodyEl.innerHTML = renderMarkdown(acc);
      log.scrollTop = log.scrollHeight;
    } else if (evt.event === 'pending') {
      const data = evt.data as { calls: PendingCall[] };
      pending = data.calls;
      renderPending();
    } else if (evt.event === 'trace') {
      trace = evt.data as Trace;
    } else if (evt.event === 'error') {
      const data = evt.data as { message: string };
      addError(data.message);
    }
  });

  if (trace) {
    const t: Trace = trace;
    const det = document.createElement('details');
    det.className = 'trace';
    const sources = (t.sources ?? []).map((s: string) => `<li>${s}</li>`).join('');
    const tools = t.toolEvents ?? [];
    const toolNames = tools.map((tt) => tt.name).join(', ');
    det.innerHTML = `<summary>trace · ${t.sources.length} sources${toolNames ? ' · tools: ' + toolNames : ''}</summary><ul>${sources}</ul>`;
    bubble.appendChild(det);
  }
}

function renderPending(): void {
  const el = document.getElementById('chat-pending')!;
  if (!pending.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div>The model wants to run a tool that requires confirmation:</div>
    ${pending.map((c) => `
      <div class="pending-call">▸ <strong>${c.name}</strong>(${escapeJson(c.arguments)})</div>
    `).join('')}
    <div class="pending-actions">
      <button id="approve-all">approve</button>
      <button class="ghost" id="reject-all">discard</button>
    </div>`;
  document.getElementById('approve-all')!.addEventListener('click', () => approve(pending.map((c) => c.id)));
  document.getElementById('reject-all')!.addEventListener('click', () => {
    pending = [];
    renderPending();
  });
}

async function approve(callIds: string[]): Promise<void> {
  pending = [];
  renderPending();
  await streamTurn('/api/confirm', { sessionId, callIds });
}

function addMessage(role: 'user' | 'assistant', text: string): void {
  const log = document.getElementById('chat-log')!;
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-role">${role}</div><div class="msg-body">${renderMarkdown(text)}</div>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function addError(msg: string): void {
  const log = document.getElementById('chat-log')!;
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.innerHTML = `<div class="msg-role" style="color:var(--error)">error</div><div class="msg-body">${escape(msg)}</div>`;
  log.appendChild(div);
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!
  ));
}
function escapeJson(o: unknown): string {
  return escape(JSON.stringify(o));
}
