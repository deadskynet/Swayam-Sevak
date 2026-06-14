/**
 * Typed fetch wrappers for the swayam web API.
 *
 * Reads the per-process token from <meta name="swayam-token"> and attaches
 * it to every POST. Throws on non-2xx with the response body as the message.
 */

function token(): string {
  const m = document.querySelector('meta[name="swayam-token"]');
  if (!m) throw new Error('swayam-token meta not found in page');
  return (m as HTMLMetaElement).content;
}

async function ok(r: Response): Promise<Response> {
  if (r.ok) return r;
  let body = '';
  try { body = await r.text(); } catch { /* ignore */ }
  throw new Error(`${r.status} ${r.statusText}: ${body || '(no body)'}`);
}

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: 'GET' });
  return (await ok(r)).json() as Promise<T>;
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-swayam-token': token(),
    },
    body: JSON.stringify(body),
  });
  return (await ok(r)).json() as Promise<T>;
}

export async function postMultipart(path: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'x-swayam-token': token() },
    body: fd,
  });
  return (await ok(r)).json();
}

export type SSEEvent = { event: string; data: unknown };

/**
 * POST + parse SSE response.  Calls `onEvent` per event; resolves when the
 * stream ends.
 */
export async function postSSE(
  path: string,
  body: unknown,
  onEvent: (e: SSEEvent) => void,
): Promise<void> {
  const r = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-swayam-token': token(),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  if (!r.body) throw new Error('no response body');
  const reader = r.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const evt = parseSSEBlock(block);
      if (evt) onEvent(evt);
    }
  }
}

function parseSSEBlock(block: string): SSEEvent | null {
  let event = '';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7);
    else if (line.startsWith('data: ')) data += line.slice(6);
  }
  if (!event) return null;
  let parsed: unknown = data;
  try { parsed = JSON.parse(data); } catch { /* keep string */ }
  return { event, data: parsed };
}
