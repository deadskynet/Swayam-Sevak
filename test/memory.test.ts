/**
 * Memory: daily log append, recall, distill round-trip.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempData: string;

beforeEach(async () => {
  tempData = await mkdtemp(join(tmpdir(), 'swayam-mem-'));
  process.env.SWAYAM_DATA_DIR = tempData;
  // Reset module cache so paths.ts re-reads SWAYAM_DATA_DIR.
  // Vitest gives us a fresh module per test file, so this is fine.
});

afterEach(async () => {
  await rm(tempData, { recursive: true, force: true });
});

describe('memory.daily-log', () => {
  it('appends a markdown section to today\'s log', async () => {
    const { paths } = await import('../src/config/paths.js');
    const { appendDailyLog } = await import('../src/memory/daily-log.js');
    await appendDailyLog({
      ts: new Date('2026-06-12T10:00:00Z'),
      source: 'chat',
      workspace: 'personal',
      summary: 'first thing',
      details: 'body of the entry',
    });
    const f = join(paths.memoryDir, '2026-06-12.md');
    const md = await readFile(f, 'utf8');
    expect(md).toContain('## 2026-06-12T10:00:00.000Z');
    expect(md).toContain('first thing');
    expect(md).toContain('body of the entry');
  });
});

describe('memory.recall', () => {
  it('finds matching sections by token overlap', async () => {
    const { paths } = await import('../src/config/paths.js');
    const { recall } = await import('../src/memory/recall.js');

    await mkdir(paths.memoryDir, { recursive: true });
    await writeFile(
      join(paths.memoryDir, 'MEMORY.md'),
      '# MEMORY.md\n\n## SAP project\n\nWorking on the openclaw ingestion pipeline.\n\n## Hobbies\n\nGardening on weekends.\n',
    );
    const hits = await recall({ query: 'openclaw ingestion', workspace: 'personal', limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.source).toContain('SAP');
  });
});
