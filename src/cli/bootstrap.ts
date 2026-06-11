/**
 * Shared CLI bootstrap — loads provider, tools, and the active workspace.
 */
import { loadRuntimeConfig } from '../config/load.js';
import { makeProvider } from '../llm/registry.js';
import { loadTools, snapshot } from '../tools/registry.js';
import { getActiveWorkspace } from '../memory/workspace.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';

export async function bootstrap() {
  const cfg = loadRuntimeConfig();
  const provider = makeProvider(cfg);
  const tools = await loadTools();
  const snap = await snapshot(tools);
  const workspace = await getActiveWorkspace();
  const orchestrator = new Orchestrator({
    provider,
    tools: snap.enabled,
    workspace,
  });
  return { cfg, provider, workspace, orchestrator, snap };
}
