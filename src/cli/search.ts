/**
 * `swayam search "<query>"`
 */
import { getActiveWorkspace } from '../memory/workspace.js';
import { unifiedSearch, formatUnifiedSearch } from '../search/unified.js';

export async function runSearch(query: string): Promise<void> {
  const workspace = await getActiveWorkspace();
  const r = await unifiedSearch({ workspace, query });
  console.log(formatUnifiedSearch(r));
}
