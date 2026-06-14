/**
 * Sessions tab — JSONL trace viewer.
 */
import { getJSON } from '../api.js';

interface SessionList { sessions: Array<{ id: string }> }
interface SessionDetail { id: string; events: Array<{
  ts?: string; level?: string; scope?: string; message?: string; data?: unknown;
}> }

let activeId: string | null = null;

export async function refreshSessions(): Promise<void> {
  const data = await getJSON<SessionList>('/api/sessions');
  const list = document.getElementById('sessions-list')!;
  list.innerHTML = '';
  for (const s of data.sessions) {
    const li = document.createElement('li');
    li.textContent = s.id;
    if (s.id === activeId) li.classList.add('active');
    li.addEventListener('click', () => loadSession(s.id));
    list.appendChild(li);
  }
  if (data.sessions.length && !activeId) {
    await loadSession(data.sessions[0]!.id);
  } else if (!data.sessions.length) {
    document.getElementById('session-events')!.innerHTML =
      '<em style="color:var(--muted)">No sessions yet.</em>';
  }
}

async function loadSession(id: string): Promise<void> {
  activeId = id;
  for (const li of document.querySelectorAll<HTMLElement>('#sessions-list li')) {
    li.classList.toggle('active', li.textContent === id);
  }
  const data = await getJSON<SessionDetail>(`/api/sessions?id=${encodeURIComponent(id)}`);
  const wrap = document.getElementById('session-events')!;
  wrap.innerHTML = '';
  for (const e of data.events) {
    const div = document.createElement('div');
    div.className = 'event';
    const ts = (e.ts ?? '').slice(11, 19);
    const data2 = e.data ? `\n  ${escapeJson(e.data)}` : '';
    div.innerHTML =
      `<span class="event-scope">${escape(e.scope ?? '?')}</span>` +
      `<span class="event-msg"> [${escape(ts)}] ${escape(e.message ?? '')}</span>` +
      (data2 ? `<div class="event-data">${escape(data2)}</div>` : '');
    wrap.appendChild(div);
  }
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]!));
}
function escapeJson(o: unknown): string {
  return JSON.stringify(o);
}
