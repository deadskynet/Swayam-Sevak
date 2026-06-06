/**
 * Tool interface + registry types.
 *
 * Each tool is a default-exported `Tool` from a file under `src/tools/`. The
 * registry discovers them at runtime — no central switch statement. To add a
 * tool, drop a file in that directory and restart.
 */
import type { ToolSpec } from '../llm/types.js';

export interface ToolContext {
  /** Active workspace name. */
  workspace: string;
  /** Absolute path to the active workspace root. */
  workspaceDir: string;
  /** Provided so tools can call back into the LLM (NL-to-cron, distill). */
  llmComplete?: (system: string, user: string) => Promise<string>;
}

export interface ToolResult {
  /** Free-form textual result fed back to the LLM. */
  text: string;
  /** Structured payload, persisted in the explainability trace. */
  data?: unknown;
}

export interface Tool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  /** True for tools that take destructive/external action. The orchestrator
   *  will refuse to execute these without an explicit user confirmation. */
  requiresConfirmation: boolean;
  /** Set to true if the tool is unavailable in the current environment
   *  (missing credentials, missing binary, etc.). The registry surfaces this
   *  to the user so they know why a feature is dark. */
  disabled?: () => boolean | Promise<boolean>;
  /** Reason returned to the user when `disabled()` is true. */
  disabledReason?: string;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** Helper for converting a Tool to the LLM-facing ToolSpec. */
export function toToolSpec(t: Tool): ToolSpec {
  return { name: t.name, description: t.description, schema: t.schema };
}
