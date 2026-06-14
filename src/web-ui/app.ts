/**
 * App shell — wires the tabbed nav and bootstraps each tab on first activation.
 */
import { getJSON } from './api.js';
import { initChat } from './tabs/chat.js';
import { refreshMemory } from './tabs/memory.js';
import { refreshSessions } from './tabs/sessions.js';
import { refreshDocs, initDocs } from './tabs/docs.js';
import { refreshWorkspaces, initWorkspaceForm } from './tabs/workspaces.js';

interface State {
  workspace: string;
  provider: string;
}

const initialised = new Set<string>();

async function bootHeader(): Promise<void> {
  const s = await getJSON<State>('/api/state');
  document.getElementById('meta-workspace')!.textContent = `workspace: ${s.workspace}`;
  document.getElementById('meta-provider')!.textContent  = `provider: ${s.provider}`;
}

async function activate(name: string): Promise<void> {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === name);
  }
  for (const pane of document.querySelectorAll<HTMLElement>('.pane')) {
    pane.classList.toggle('active', pane.id === `pane-${name}`);
  }
  if (!initialised.has(name)) {
    initialised.add(name);
    if (name === 'chat')        initChat();
    if (name === 'docs')        initDocs();
    if (name === 'workspaces')  initWorkspaceForm();
  }
  // Always refresh on activate so data is current.
  if (name === 'memory')     await refreshMemory();
  if (name === 'sessions')   await refreshSessions();
  if (name === 'docs')       await refreshDocs();
  if (name === 'workspaces') await refreshWorkspaces();
}

(async () => {
  try {
    await bootHeader();
  } catch (err) {
    document.body.innerHTML =
      `<pre style="padding:24px;color:var(--error)">failed to load /api/state: ${
        err instanceof Error ? err.message : String(err)
      }</pre>`;
    return;
  }
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab')) {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      if (name) void activate(name);
    });
  }
  await activate('chat');
})();
