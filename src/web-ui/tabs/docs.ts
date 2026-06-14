/**
 * Documents tab — list ingested docs + drag-drop ingest.
 */
import { getJSON, postMultipart } from '../api.js';

interface DocsList {
  workspace: string;
  docs: Array<{ id: string; path: string; ingestedAt: string; chunks: number }>;
  totalChunks: number;
}

interface IngestResult {
  ingested: Array<{ path: string; chunks: number }>;
  skipped: Array<{ path: string; reason: string }>;
}

export async function refreshDocs(): Promise<void> {
  const data = await getJSON<DocsList>('/api/docs');
  const tbody = document.querySelector('#docs-table tbody')!;
  tbody.innerHTML = '';
  for (const d of data.docs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${escape(d.path)}">${escape(short(d.path))}</td>
      <td>${d.chunks}</td>
      <td>${escape(d.ingestedAt.slice(0, 19))}</td>`;
    tbody.appendChild(tr);
  }
  if (!data.docs.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted)">No documents ingested in this workspace.</td></tr>';
  }
}

export function initDocs(): void {
  const drop = document.getElementById('docs-drop')!;
  const file = document.getElementById('docs-file') as HTMLInputElement;
  const status = document.getElementById('docs-status')!;

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f) await ingest(f, status);
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) await ingest(f, status);
    file.value = '';
  });
}

async function ingest(f: File, status: HTMLElement): Promise<void> {
  status.textContent = `ingesting ${f.name} …`;
  try {
    const r = (await postMultipart('/api/docs/ingest', f)) as IngestResult;
    if (r.ingested.length) {
      const total = r.ingested.reduce((n, x) => n + x.chunks, 0);
      status.textContent = `ingested ${f.name} → ${total} chunks`;
    } else if (r.skipped.length) {
      status.textContent = `skipped: ${r.skipped[0]!.reason}`;
    }
    await refreshDocs();
  } catch (err) {
    status.textContent = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function short(p: string): string {
  if (p.length < 60) return p;
  return '…' + p.slice(p.length - 58);
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!
  ));
}
