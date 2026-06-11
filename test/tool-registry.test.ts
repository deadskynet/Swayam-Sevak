/**
 * Tool registry — dynamic discovery picks up the file-based tools.
 */
import { describe, it, expect } from 'vitest';
import { loadTools } from '../src/tools/registry.js';

describe('tool registry', () => {
  it('discovers all tools from src/tools', async () => {
    const tools = await loadTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('now');
    expect(names).toContain('memory_search');
    expect(names).toContain('docs_search');
    expect(names).toContain('workspace_files');
    // Ordered alphabetically.
    expect([...names].sort()).toEqual(names);
  });

  it('all tools have well-formed schemas', async () => {
    const tools = await loadTools();
    for (const t of tools) {
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe('string');
      expect(t.schema).toBeTruthy();
      expect(typeof t.execute).toBe('function');
    }
  });
});
