/**
 * Tiny SSE writer.
 *
 * SSE is a one-way stream from the server to the browser. The browser opens
 * `new EventSource(url)` (for GET) or, in our case, a `fetch().body.getReader()`
 * for POST + streaming. Each event is `event: <name>\ndata: <json>\n\n`.
 */
import type { ServerResponse } from 'node:http';

export class SSEStream {
  private closed = false;

  constructor(private res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  }

  send(event: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }
}
