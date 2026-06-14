/**
 * Web server smoke test.
 *
 * Boots the server on a random port (port 0) with the offline echo provider
 * and a temp data dir. Exercises the API contract for state, workspaces,
 * memory, sessions, docs, and the SSE chat stream.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempData: string;

beforeEach(async () => {
  tempData = await mkdtemp(join(tmpdir(), 'swayam-web-'));
  process.env.SWAYAM_DATA_DIR = tempData;
  // Force a fresh `paths` module per test so SWAYAM_DATA_DIR is re-read.
  vi.resetModules();
  await mkdir(join(tempData, 'workspaces', 'personal'), { recursive: true });
  await writeFile(join(tempData, 'workspaces', 'personal', 'MEMORY.md'),
    '# Workspace: personal — MEMORY.md\n');
  await writeFile(join(tempData, 'workspaces', 'personal', 'USER.md'),
    '# USER.md (workspace: personal)\n');
  await mkdir(join(tempData, 'memory'), { recursive: true });
  await writeFile(join(tempData, 'memory', 'MEMORY.md'),
    '# MEMORY.md\n\n## test\nA test fact.\n');
  await writeFile(join(tempData, 'active-workspace'), 'personal\n');
});

afterEach(async () => {
  await rm(tempData, { recursive: true, force: true });
});

describe('web server', () => {
  it('serves /api/state with provider + workspace + tools', async () => {
    const { startWebServer } = await import('../src/web/server.js');
    const { EchoProvider } = await import('../src/llm/providers/echo.js');
    const { loadTools, snapshot } = await import('../src/tools/registry.js');

    const tools = await loadTools();
    const snap = await snapshot(tools);
    const server = await startWebServer({
      provider: new EchoProvider(),
      tools: snap.enabled.concat(snap.disabled.map((d) => d.tool)),
      enabledTools: snap.enabled,
      workspace: 'personal',
      port: 0,
      quiet: true,
    });

    try {
      const r = await fetch(`${server.url}/api/state`);
      expect(r.status).toBe(200);
      const body = (await r.json()) as { workspace: string; provider: string; tools: { enabled: unknown[] } };
      expect(body.workspace).toBe('personal');
      expect(body.provider).toBe('echo');
      expect(Array.isArray(body.tools.enabled)).toBe(true);
    } finally {
      await server.stop();
    }
  });

  it('streams a chat turn over SSE', async () => {
    const { startWebServer } = await import('../src/web/server.js');
    const { EchoProvider } = await import('../src/llm/providers/echo.js');
    const { loadTools, snapshot } = await import('../src/tools/registry.js');

    const tools = await loadTools();
    const snap = await snapshot(tools);
    const server = await startWebServer({
      provider: new EchoProvider(),
      tools: snap.enabled.concat(snap.disabled.map((d) => d.tool)),
      enabledTools: snap.enabled,
      workspace: 'personal',
      port: 0,
      quiet: true,
    });

    try {
      const r = await fetch(`${server.url}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-swayam-token': server.token,
        },
        body: JSON.stringify({ sessionId: 'test-1', message: 'hello world' }),
      });
      expect(r.status).toBe(200);
      const text = await r.text();
      expect(text).toContain('event: start');
      expect(text).toContain('event: text');
      expect(text).toContain('[echo] hello world');
      expect(text).toContain('event: trace');
      expect(text).toContain('event: done');
    } finally {
      await server.stop();
    }
  });

  it('rejects POST without the token', async () => {
    const { startWebServer } = await import('../src/web/server.js');
    const { EchoProvider } = await import('../src/llm/providers/echo.js');
    const { loadTools, snapshot } = await import('../src/tools/registry.js');

    const snap = await snapshot(await loadTools());
    const server = await startWebServer({
      provider: new EchoProvider(),
      tools: snap.enabled,
      enabledTools: snap.enabled,
      workspace: 'personal',
      port: 0,
      quiet: true,
    });

    try {
      const r = await fetch(`${server.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 't', message: 'x' }),
      });
      expect(r.status).toBe(403);
    } finally {
      await server.stop();
    }
  });

  it('serves the index with the token injected', async () => {
    const { startWebServer } = await import('../src/web/server.js');
    const { EchoProvider } = await import('../src/llm/providers/echo.js');
    const { loadTools, snapshot } = await import('../src/tools/registry.js');

    const snap = await snapshot(await loadTools());
    const server = await startWebServer({
      provider: new EchoProvider(),
      tools: snap.enabled,
      enabledTools: snap.enabled,
      workspace: 'personal',
      port: 0,
      quiet: true,
    });

    try {
      const r = await fetch(server.url + '/');
      const html = await r.text();
      expect(html).toContain(`<meta name="swayam-token" content="${server.token}">`);
      expect(html).toContain('<button class="tab active" data-tab="chat"');
    } finally {
      await server.stop();
    }
  });

  it('lists docs (empty initially) and memory', async () => {
    const { startWebServer } = await import('../src/web/server.js');
    const { EchoProvider } = await import('../src/llm/providers/echo.js');
    const { loadTools, snapshot } = await import('../src/tools/registry.js');

    const snap = await snapshot(await loadTools());
    const server = await startWebServer({
      provider: new EchoProvider(),
      tools: snap.enabled,
      enabledTools: snap.enabled,
      workspace: 'personal',
      port: 0,
      quiet: true,
    });

    try {
      const docs = (await (await fetch(`${server.url}/api/docs`)).json()) as { docs: unknown[] };
      expect(docs.docs.length).toBe(0);

      const mem = (await (await fetch(`${server.url}/api/memory`)).json()) as { globalMemory: string };
      expect(mem.globalMemory).toContain('test fact');
    } finally {
      await server.stop();
    }
  });
});
