/**
 * `swayam tools` — show registered tools and which are disabled.
 */
import { loadTools, snapshot } from '../tools/registry.js';

export async function runToolsList(): Promise<void> {
  const tools = await loadTools();
  const snap = await snapshot(tools);

  console.log('Enabled tools:');
  if (!snap.enabled.length) console.log('  (none)');
  for (const t of snap.enabled) {
    const conf = t.requiresConfirmation ? '  [requires confirmation]' : '';
    console.log(`  - ${t.name}${conf}`);
    console.log(`      ${t.description}`);
  }

  if (snap.disabled.length) {
    console.log('\nDisabled tools:');
    for (const { tool, reason } of snap.disabled) {
      console.log(`  - ${tool.name} — ${reason}`);
    }
  }
}
