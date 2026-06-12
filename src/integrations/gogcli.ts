/**
 * gogcli wrapper — shells out to `gog` and parses JSON output.
 *
 * gogcli is the user's local Google CLI (https://gogcli.com). It handles
 * OAuth and exposes Gmail, Calendar, etc. via subcommands. We never reimplement
 * Google APIs — every Gmail/Calendar tool routes through here.
 *
 * We do not pin gogcli's exact CLI surface here because it evolves. Instead
 * we expose a thin `gog(args)` helper and a few command builders. Each tool
 * documents the `gog` commands it expects; if those drift, the tool's failure
 * mode is "gog returned non-JSON" or "gog exited non-zero", surfaced verbatim
 * to the user — much better than a silent fall-through.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadRuntimeConfig } from '../config/load.js';

const execFileP = promisify(execFile);

export class GogError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly code: number | null,
  ) {
    super(message);
    this.name = 'GogError';
  }
}

export async function gogAvailable(): Promise<boolean> {
  const cfg = loadRuntimeConfig();
  try {
    await execFileP(cfg.gog.bin, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `gog <args...>`. Stdout is returned as a string; stderr is captured.
 * Throws GogError on non-zero exit.
 */
export async function gog(
  args: string[],
  opts: { timeout?: number } = {},
): Promise<string> {
  const cfg = loadRuntimeConfig();
  try {
    const { stdout } = await execFileP(cfg.gog.bin, args, {
      timeout: opts.timeout ?? 30000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch (err: unknown) {
    const e = err as { stderr?: string; code?: number; message?: string };
    throw new GogError(
      `gog ${args.join(' ')} failed: ${e.message ?? 'unknown'}`,
      e.stderr ?? '',
      typeof e.code === 'number' ? e.code : null,
    );
  }
}

/** Convenience: run `gog ...` and parse stdout as JSON. */
export async function gogJson<T>(args: string[], opts: { timeout?: number } = {}): Promise<T> {
  const out = await gog(args, opts);
  try {
    return JSON.parse(out) as T;
  } catch (err) {
    throw new GogError(
      `gog ${args.join(' ')} did not return JSON: ${(err as Error).message}`,
      out.slice(0, 500),
      0,
    );
  }
}
