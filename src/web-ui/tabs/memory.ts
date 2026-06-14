/**
 * Memory tab.
 */
import { getJSON } from '../api.js';
import { renderMarkdown } from '../md.js';

interface MemoryRoot {
  workspace: string;
  workspaceMemory: string;
  globalMemory: string;
  logs: Array<{ date: string }>;
}

interface DailyLog { date: string; content: string }

let activeLog: string | null = null;

export async function refreshMemory(): Promise<void> {
  const data = await getJSON<MemoryRoot>('/api/memory');
  const wsEl = document.getElementById('memory-workspace')!;
  wsEl.innerHTML = renderMarkdown(data.workspaceMemory || '*(empty)*');

  const logsEl = document.getElementById('memory-logs')!;
  logsEl.innerHTML = '';
  for (const l of data.logs.slice(0, 14)) {
    const li = document.createElement('li');
    li.textContent = l.date;
    if (l.date === activeLog) li.classList.add('active');
    li.addEventListener('click', () => loadLog(l.date));
    logsEl.appendChild(li);
  }

  // Auto-load the most recent log.
  if (data.logs.length && !activeLog) {
    await loadLog(data.logs[0]!.date);
  } else if (!data.logs.length) {
    document.getElementById('memory-log-content')!.innerHTML =
      '<em style="color:var(--muted)">No daily logs yet. Send a chat message and one will appear here.</em>';
  }
}

async function loadLog(date: string): Promise<void> {
  activeLog = date;
  for (const li of document.querySelectorAll<HTMLElement>('#memory-logs li')) {
    li.classList.toggle('active', li.textContent === date);
  }
  const data = await getJSON<DailyLog>(`/api/memory/log?date=${encodeURIComponent(date)}`);
  document.getElementById('memory-log-content')!.innerHTML =
    renderMarkdown(data.content || '*(empty)*');
}
