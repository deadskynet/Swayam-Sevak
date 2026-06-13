# Roadmap

## v1 (this build) — what's in

All sixteen subsystems from the brief, end-to-end:

- ✅ **Personality** — SOUL, IDENTITY, AGENTS, TOOLS, USER as plain markdown.
- ✅ **Memory** — daily logs + MEMORY.md (global + per-workspace), append-only with distillation command.
- ✅ **Workspaces** — switch active workspace; overlays apply automatically.
- ✅ **Tools** — file-based dynamic discovery, no central switch.
- ✅ **LLM providers** — `echo`, `anthropic`, `huggingface` behind one interface.
- ✅ **Orchestrator** — single bounded turn loop, deterministic.
- ✅ **CLI** — `chat`, `ask`, `memory`, `workspace`, `docs`, `search`, `briefing`, `weekly`, `schedule`, `telegram`, `tools`.
- ✅ **Gmail/Calendar** — via gogcli shell-out; tools auto-disable when `gog` missing.
- ✅ **Documents** — PDF/MD/TXT/DOCX ingestion, TF-IDF index per workspace.
- ✅ **Unified search** — parallel fan-out over memory, docs, gmail.
- ✅ **Daily briefing & weekly review** — composed from calendar + email + memory + logs.
- ✅ **Meeting prep tool** — aggregator, deterministic.
- ✅ **Scheduler** — NL→cron, persisted in `data/schedules.json`, runs while a long-running process is up.
- ✅ **Telegram** — long-poll, single user, confirmations via reply-yes.
- ✅ **Explainability** — JSONL traces + daily-log mirror + `/trace` REPL command.

## v1 — what's intentionally minimal (fully working, but a known shortcut)

- **RAG.** TF-IDF over a JSON index instead of vector embeddings. Works well to a few thousand chunks, fully offline, fully explainable.
- **Telegram confirmations.** Plain text "yes" instead of inline keyboards.
- **Scheduler lifetime.** Cron runs only while `swayam telegram start` (or another long-running process) is up. Fine for a personal assistant; if you want background-on-login, wrap it in launchd/systemd.
- **HuggingFace tool use.** Emulated via a JSON-envelope contract in the system prompt. Capable models (Llama-3.1-8B+, Qwen2.5-7B+) honor it reliably; small models don't.
- **DOCX parsing.** Hand-rolled zip walk + tag-strip. Lossy for tables/footnotes — replace with `mammoth` if richer extraction matters.

## v2 — backlog

- **Web UI** — Next.js memory viewer + chat. The CLI surfaces enough for v1; the UI is for navigation, not capability.
- **Embeddings** — swap the TF-IDF doc index for a local embedding model (e.g. `nomic-embed-text` via Ollama) when corpora grow.
- **Vector DB** — LanceDB once embeddings are in. The `addDoc/searchIndex` interface is unchanged.
- **Telegram inline keyboards** — proper confirmation UX with one-tap approve/deny buttons.
- **Plugin manifest** — only when a third tool consumer appears. Today's auto-discovery is right.
- **Multi-provider stream wrappers** — only when a third provider with idiosyncratic tool-use semantics joins.
- **Voice / audio** — speech-to-text input via local Whisper, TTS replies.
- **Background daemon** — launchd/systemd unit so schedules run without a foreground process.
- **Better daily-log structure** — embedded YAML frontmatter per entry for stricter parsing (currently we rely on the `## <iso>` heading convention).
- **Memory pruning policy** — when distillation has captured a daily log's worth, optionally archive that log under `data/memory/archive/`.

## Explicitly out of scope (per brief)

- Multi-user accounts.
- Cloud hosting / deployment.
- Enterprise SSO, audit logs beyond the local JSONL traces.
