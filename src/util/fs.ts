/**
 * Filesystem helpers used across the codebase.
 */
import { mkdir, writeFile, readFile, access, appendFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';

export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export async function writeText(p: string, content: string): Promise<void> {
  await ensureDir(dirname(p));
  await writeFile(p, content, 'utf8');
}

export async function appendText(p: string, content: string): Promise<void> {
  await ensureDir(dirname(p));
  await appendFile(p, content, 'utf8');
}

export async function readText(p: string, fallback = ''): Promise<string> {
  if (!(await pathExists(p))) return fallback;
  return readFile(p, 'utf8');
}

export async function readJson<T>(p: string, fallback: T): Promise<T> {
  if (!(await pathExists(p))) return fallback;
  const raw = await readFile(p, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(p: string, value: unknown): Promise<void> {
  await writeText(p, JSON.stringify(value, null, 2) + '\n');
}
