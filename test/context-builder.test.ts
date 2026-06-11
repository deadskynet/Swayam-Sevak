/**
 * Context builder — verifies prompt assembly ordering.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempData: string;

beforeEach(async () => {
  tempData = await mkdtemp(join(tmpdir(), 'swayam-ctx-'));
  process.env.SWAYAM_DATA_DIR = tempData;
});

afterEach(async () => {
  await rm(tempData, { recursive: true, force: true });
});

describe('context builder', () => {
  it('assembles a prompt with personality, memory, and tool catalog', async () => {
    const { paths } = await import('../src/config/paths.js');
    const { buildContext } = await import('../src/orchestrator/context-builder.js');
    const { assembleSystemPrompt } = await import('../src/orchestrator/prompt-assembler.js');

    await mkdir(paths.memoryDir, { recursive: true });
    await writeFile(
      join(paths.memoryDir, 'MEMORY.md'),
      '# MEMORY.md\n\n## Recent work\n\nBuilding swayam-sevak.\n',
    );
    await mkdir(paths.workspaceDir('personal'), { recursive: true });
    await writeFile(
      paths.workspaceMemoryFile('personal'),
      '# Workspace: personal\n\n## Goals\n\nMake the assistant explainable.\n',
    );

    const ctx = await buildContext({
      workspace: 'personal',
      tools: [],
      query: 'explainable assistant',
    });
    const prompt = assembleSystemPrompt(ctx);

    // Personality blocks present.
    expect(prompt).toContain('# IDENTITY');
    expect(prompt).toContain('# SOUL');
    expect(prompt).toContain('# AGENTS');
    expect(prompt).toContain('# USER');
    // Workspace block present.
    expect(prompt).toContain('# WORKSPACE: personal');
    // Recall hits present (token overlap on 'explainable').
    expect(prompt).toContain('RECALLED MEMORY');
    // Ordering: IDENTITY before SOUL before WORKSPACE.
    const idxIdentity = prompt.indexOf('# IDENTITY');
    const idxSoul = prompt.indexOf('# SOUL');
    const idxWs = prompt.indexOf('# WORKSPACE');
    expect(idxIdentity).toBeLessThan(idxSoul);
    expect(idxSoul).toBeLessThan(idxWs);
  });
});
