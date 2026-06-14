/**
 * Workspaces tab.
 */
import { getJSON, postJSON } from '../api.js';

interface WorkspacesList { workspaces: string[]; active: string }

export async function refreshWorkspaces(): Promise<void> {
  const data = await getJSON<WorkspacesList>('/api/workspaces');
  const list = document.getElementById('workspaces-list')!;
  list.innerHTML = '';
  for (const w of data.workspaces) {
    const li = document.createElement('li');
    if (w === data.active) li.classList.add('active');
    li.innerHTML = `<span class="ws-name">${escape(w)}</span>`;
    if (w !== data.active) {
      const btn = document.createElement('button');
      btn.textContent = 'switch';
      btn.className = 'ghost';
      btn.addEventListener('click', async () => {
        await postJSON('/api/workspaces/use', { name: w });
        location.reload();
      });
      li.appendChild(btn);
    } else {
      const tag = document.createElement('span');
      tag.textContent = 'active';
      tag.style.color = 'var(--accent)';
      tag.style.fontSize = '12px';
      li.appendChild(tag);
    }
    list.appendChild(li);
  }
}

export function initWorkspaceForm(): void {
  const form = document.getElementById('workspace-create-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('workspace-name') as HTMLInputElement;
    const name = input.value.trim();
    if (!name) return;
    try {
      await postJSON('/api/workspaces/create', { name });
      input.value = '';
      await refreshWorkspaces();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  });
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]!));
}
