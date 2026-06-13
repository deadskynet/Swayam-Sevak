# Architecture

## Topology

```
User
 └─ CLI (commander + readline)        ── or Telegram (long-poll)
     └─ Orchestrator
         ├─ ContextBuilder ── reads SOUL/IDENTITY/AGENTS/TOOLS/USER + memory + workspace
         ├─ PromptAssembler ── deterministic system-prompt ordering
         ├─ LLMProvider ── echo | anthropic | huggingface
         ├─ ToolRouter ── dispatches calls to dynamically-discovered tools
         └─ DailyLog ── appends a per-turn audit entry
```

A turn is one shape:

1. `ContextBuilder` gathers everything — personality, workspace, memory, recall hits.
2. `PromptAssembler` produces the system prompt.
3. `LLMProvider.complete()` returns either text or tool calls.
4. If tool calls, `ToolRouter.dispatch()` runs each (or returns "pending confirmation"). Tool results are appended to the message history; we loop.
5. Tool loop is bounded by `MAX_TOOL_ITERATIONS = 8`.
6. Final reply is returned and mirrored to the daily log.

## File layout — what each module owns

| Path                                  | Owns                                                                    |
|---------------------------------------|-------------------------------------------------------------------------|
| `src/config/paths.ts`                 | All absolute paths. Override the data dir with `SWAYAM_DATA_DIR`.       |
| `src/config/load.ts`                  | Env vars + the five personality markdown files.                         |
| `src/util/logger.ts`                  | Structured event logging → stderr + per-session JSONL.                  |
| `src/util/fs.ts`                      | Filesystem helpers (read/write/json/append/ensureDir).                  |
| `src/llm/types.ts`                    | `LLMProvider`, `ChatMessage`, `ToolCallRequest`.                        |
| `src/llm/providers/{echo,anthropic,huggingface}.ts` | Three adapters behind the same interface.                  |
| `src/llm/registry.ts`                 | Picks the provider from `SWAYAM_PROVIDER`.                              |
| `src/memory/daily-log.ts`             | Append to `data/memory/YYYY-MM-DD.md`.                                  |
| `src/memory/long-term.ts`             | Read/write of `MEMORY.md` (global + per-workspace).                     |
| `src/memory/recall.ts`                | Token-overlap recall over MEMORY.md and recent daily logs.              |
| `src/memory/distill.ts`               | LLM-driven distillation of daily logs into workspace MEMORY.md.         |
| `src/memory/workspace.ts`             | Workspace switching and creation.                                       |
| `src/tools/types.ts`                  | `Tool`, `ToolContext`, `ToolResult`.                                    |
| `src/tools/registry.ts`               | Dynamic discovery of `src/tools/*.ts`.                                  |
| `src/tools/<name>.ts`                 | One tool per file, default-exported.                                    |
| `src/orchestrator/context-builder.ts` | Gathers BuiltContext.                                                   |
| `src/orchestrator/prompt-assembler.ts`| BuiltContext → system prompt string.                                    |
| `src/orchestrator/tool-router.ts`     | Dispatch with confirmation enforcement.                                 |
| `src/orchestrator/orchestrator.ts`    | The bounded turn loop.                                                  |
| `src/integrations/gogcli.ts`          | Shell-out wrapper for `gog` (Gmail/Calendar).                           |
| `src/integrations/telegram.ts`        | Long-poll bot routing through the orchestrator.                         |
| `src/docs/{ingest,chunk,store}.ts`    | TF-IDF doc intelligence (PDF, MD, TXT, DOCX).                           |
| `src/scheduler/{scheduler,nl-to-cron}.ts` | Persistent cron + LLM NL→cron.                                      |
| `src/search/unified.ts`               | Parallel fan-out: memory + docs + gmail.                                |
| `src/briefing/{daily,weekly}.ts`      | Briefing composition over LLM.                                          |
| `src/cli/*`                           | One file per top-level subcommand.                                      |

## Storage philosophy

- **Personality** (SOUL/IDENTITY/AGENTS/TOOLS/USER) lives in `config/` as markdown. The user edits these directly. The context builder splices them verbatim into the system prompt.
- **Memory** lives in `data/memory/`:
  - `MEMORY.md` — global long-term memory
  - `YYYY-MM-DD.md` — append-only daily logs
- **Workspace memory** lives in `data/workspaces/<name>/MEMORY.md`. Workspace `USER.md` is layered over the global `USER.md` at context-build time.
- **Sessions** are JSONL traces in `data/sessions/<id>.jsonl` — every context build, LLM call, and tool dispatch lands there.
- **Doc index** is a single JSON file per workspace at `data/docs-index/<workspace>.json` containing TF-IDF state.
- **Schedules** live in `data/schedules.json`.
- **Active workspace** is one line in `data/active-workspace`.

## Explainability

Three artefacts let you answer "why did the assistant say that?":

1. `data/sessions/<id>.jsonl` — every event of every turn. `[context] built` carries the list of files that fed the prompt; `[llm] <provider/model>` carries the response shape; `[tool] execute <name>` carries inputs.
2. `data/memory/YYYY-MM-DD.md` — every chat turn's user message, assistant reply, and the names of tools called are appended.
3. The `> /trace` REPL command prints the source list of the last turn.

## Confirmation flow

- A tool with `requiresConfirmation: true` (`gmail_send`, `calendar_create`, `schedule_create`, `schedule_remove`) is rejected by `ToolRouter` unless the orchestrator's caller has stamped the call id as approved.
- The orchestrator yields a `pendingConfirmations` array. The CLI REPL prompts `y/N` per call; Telegram asks the user to reply "yes". Either re-issues `run()` with `approvedToolCallIds`.
- v2 adds Telegram inline keyboards.

## Divergences from OpenClaw

| OpenClaw                                                       | Swayam-sevak                                                       | Why                                                          |
|----------------------------------------------------------------|--------------------------------------------------------------------|--------------------------------------------------------------|
| Plugin SDK with manifests + lazy seams                         | Convention-based `src/tools/*.ts` directory; auto-discovery        | Single-user local; manifests add ceremony with no payoff     |
| Pluggable `ContextEngine` registry                             | One concrete `ContextBuilder` with strategy hooks                  | Registry pattern is right, but premature here                |
| DAG sessions with branching/forks                              | Append-only JSONL transcripts per session                          | Simpler and matches the human-readable principle             |
| Multi-provider with stream wrappers + payload normalization    | Two adapters behind a thin `LLMProvider` interface                 | We don't need provider compat layers for two providers       |
| Channel gateway with session-key demux                         | Telegram is *a CLI command piping into the same orchestrator*      | Telegram is "another interface, not another agent"           |
| `tsdown` + multi-tsconfig + cycle checks + semgrep             | One `tsconfig.json`, `tsx` for dev, `tsup` for build, Vitest, ESLint  | Matches scope                                             |

## Adding a tool

1. Create `src/tools/my-tool.ts` exporting a default `Tool`.
2. Append the tool name to `config/TOOLS.md` (descriptive only; it's loaded into the prompt).
3. Restart. The registry discovers it on the next process start.

The orchestrator passes the tool's JSON schema through Anthropic's tool-use API natively, or splices it into the system prompt for HuggingFace via the JSON-envelope emulation.
