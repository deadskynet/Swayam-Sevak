/**
 * `swayam workspace ...`
 */
import {
  getActiveWorkspace,
  setActiveWorkspace,
  listWorkspaces,
  createWorkspace,
} from '../memory/workspace.js';

export async function runWorkspaceList(): Promise<void> {
  const active = await getActiveWorkspace();
  const all = await listWorkspaces();
  if (!all.length) {
    console.log('No workspaces. Run `swayam workspace create <name>`.');
    return;
  }
  for (const w of all) console.log(w === active ? `* ${w}` : `  ${w}`);
}

export async function runWorkspaceUse(name: string): Promise<void> {
  const all = await listWorkspaces();
  if (!all.includes(name)) {
    console.error(`workspace "${name}" does not exist. Create with \`swayam workspace create ${name}\`.`);
    process.exit(1);
  }
  await setActiveWorkspace(name);
  console.log(`active workspace: ${name}`);
}

export async function runWorkspaceCreate(name: string): Promise<void> {
  await createWorkspace(name);
  console.log(`created workspace: ${name}`);
}
