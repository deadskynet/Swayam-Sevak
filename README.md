# Swayam-Sevak

A local-first personal AI operating system for a single user. Persistent memory in plain markdown, configurable personality, modular tools, Gmail/Calendar/Telegram integrations, document understanding, and workspace isolation.

> **स्वयं-सेवक (swayam-sevak)** — "self-server". An assistant that serves you, made of files you can read.

## Quick start

```bash
cd /Users/I749880/Project/swayam-sevak
npm install
npm run seed                    # creates data/ and the default `personal` workspace
cp .env.example .env            # then add HF_TOKEN, ANTHROPIC_API_KEY, etc.
npm test                        # runs against the offline echo provider
npm run dev -- tools            # show registered tools and credentials status
npm run dev -- chat             # interactive chat
```

By default `SWAYAM_PROVIDER=echo` (offline). Switch to `anthropic` or `huggingface` once you have a key.

## Commands

```bash
swayam chat                     # interactive REPL
swayam ask "<message>"          # one-shot

swayam memory view              # inspect MEMORY.md and recent daily logs
swayam memory distill           # fold recent daily logs into MEMORY.md

swayam workspace list           # show workspaces (active marked with *)
swayam workspace create sap
swayam workspace use sap        # switch active workspace

swayam docs ingest <path>       # add a file or directory to the doc index
swayam search "<query>"         # unified search: memory + docs + gmail

swayam briefing                 # today's briefing
swayam weekly                   # weekly review

swayam schedule add "every weekday 9 AM send me my briefing"
swayam schedule list
swayam schedule remove <id>

swayam telegram start           # long-running bot + scheduler

swayam tools                    # list tools and which are disabled
```

## What lives where

```
config/         user-editable personality (SOUL/IDENTITY/AGENTS/TOOLS/USER)
src/            source
data/           runtime state — gitignored
  memory/       global MEMORY.md + daily logs (YYYY-MM-DD.md)
  workspaces/   per-workspace USER.md, MEMORY.md, documents/, notes/
  sessions/     JSONL traces of every turn
  docs-index/   TF-IDF index per workspace
  schedules.json  natural-language automations
```

## Design principles

1. **Human-readable storage.** Memory is markdown. The doc index is JSON. You can `cat` everything.
2. **Explainability.** Every turn writes a structured trace to `data/sessions/<id>.jsonl` and mirrors a summary to today's daily log. `swayam` never takes an action without naming the tool and inputs.
3. **Local-first.** Defaults work offline (echo provider, TF-IDF index). External services (LLM, Gmail, Calendar, Telegram) are opt-in.
4. **Simplicity.** One orchestrator, one bounded tool loop. No multi-agent recursion.
5. **Confirmations are real.** `gmail_send`, `calendar_create`, etc. cannot execute without an explicit user "yes".

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full design and divergences from OpenClaw, and [ROADMAP.md](ROADMAP.md) for what's intentionally minimal in v1.
