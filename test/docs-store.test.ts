/**
 * Doc store — TF-IDF round-trip.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempData: string;

beforeEach(async () => {
  tempData = await mkdtemp(join(tmpdir(), 'swayam-docs-'));
  process.env.SWAYAM_DATA_DIR = tempData;
});

afterEach(async () => {
  await rm(tempData, { recursive: true, force: true });
});

describe('docs.store', () => {
  it('indexes chunks and finds the right one for a query', async () => {
    const { addDoc, searchIndex } = await import('../src/docs/store.js');
    await addDoc('personal', {
      id: 'a',
      path: '/x/a.md',
      chunks: [
        { idx: 0, text: 'The mitochondria is the powerhouse of the cell.' },
        { idx: 1, text: 'Apples are red and grow on trees in orchards.' },
      ],
    });
    await addDoc('personal', {
      id: 'b',
      path: '/x/b.md',
      chunks: [
        { idx: 0, text: 'TypeScript adds static typing to JavaScript.' },
      ],
    });
    const hits = await searchIndex('personal', 'powerhouse cell');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.docId).toBe('a');
    expect(hits[0]?.idx).toBe(0);
  });
});
