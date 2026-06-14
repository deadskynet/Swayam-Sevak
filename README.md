# Swayam-Sevak

> स्वयं-सेवक · *swayam-sevak* — "self-server"
> An assistant that serves you, made of files you can read.

Local-first personal AI for one person. Long-term memory is plain markdown — `cat`, grep, edit. Tools are dropped into a directory and discovered. Gmail, Calendar, and Telegram are wired through one bounded orchestrator. Every action is traced to disk, so you can always answer *why did it say that?*

```text
$ swayam chat
swayam-sevak [provider=anthropic] [workspace=personal]
Type your message; "/exit" to quit, "/trace" to see what fed the last reply.

> what's on my plate this morning

You have stand-up at 09:30 and a 1:1 with Priya at 11:00.
Two emails are flagged — the vendor renewal closes today, and the OKR
doc still needs your sign-off. I'd ship the OKR sign-off before
stand-up so it's off the queue.

> /trace
config/SOUL.md
config/AGENTS.md
config/USER.md
workspaces/personal/MEMORY.md
memory/2026-06-13.md
recall:workspaces/personal/MEMORY.md#OKR cadence
```

That `/trace` is the whole pitch. There is no opaque vector store. The assistant's mind is a directory.

## Quick start

```bash
git clone https://github.com/deadskynet/Swayam-Sevak.git swayam-sevak
cd swayam-sevak
npm install
npm run seed
cp .env.example .env

# defaults to the offline `echo` provider, so this works with no keys:
npm test
npm run dev -- chat
```

Add `ANTHROPIC_API_KEY` or `HF_TOKEN` to `.env` and flip `SWAYAM_PROVIDER` to use a real model. Install `gog` (https://gogcli.com) for Gmail and Calendar. `swayam tools` will tell you which capabilities are dark and why.

## What it does

**Chat.** Bounded, deterministic tool loop. No multi-agent recursion, no autonomous loops. The model calls a tool, the tool returns, the model replies.

**Memory.** Append-only daily logs at `data/memory/YYYY-MM-DD.md`, distilled into a long-term `MEMORY.md` per workspace. `swayam memory distill` is the only thing that touches long-term memory programmatically.

**Workspaces.** e.g. `personal`, `sap`, `side-projects`. Each has its own `MEMORY.md` and an overlay `USER.md` that layers on top of the global one at context-build time. Tools can't reach across workspaces.

**Gmail and Calendar.** Search, read, draft, list events, prepare for meetings. Sending email and creating events both require an explicit confirmation — no exceptions, including over Telegram.

**Documents.** Drop in PDFs, DOCX, Markdown, plain text. They get chunked and indexed with TF-IDF per workspace. Retrieval is explainable: every hit reports the chunk and the score.

**Schedules.** Natural language to cron. `swayam schedule add "every weekday at 9 AM send me my briefing"` validates the expression with `cron-parser` before persisting. Schedules fire while a long-running process is up.

**Telegram.** Same orchestrator behind a long-poll bot. Locked to a single Telegram user by id. Confirmations come back as plain "yes" replies.

## What memory looks like

```text
$ tree -L 2 data/memory
data/memory
├── MEMORY.md
├── 2026-06-12.md
└── 2026-06-13.md
```

```markdown
## 2026-06-13T08:42:11Z · [chat] · workspace:personal
draft a reply to the vendor about renewal

**user**: draft a reply to the vendor about renewal
**assistant**: Drafted gmail/draft/abc123 — "Re: Renewal — request
for 30-day extension".
**tools**: gmail_search, gmail_draft

## 2026-06-13T19:32:00Z · [briefing] · workspace:personal
Generated daily briefing
…
```

`git diff`-able. Prunable with `vim`. Versionable.

## Commands

```text
swayam chat                   interactive REPL
swayam ask "<message>"        one-shot
swayam tools                  list registered tools and credential status

swayam memory view            inspect MEMORY.md and recent daily logs
swayam memory distill         fold recent daily logs into long-term memory

swayam workspace list/use/create

swayam docs ingest <path>     index a file or directory
swayam search "<query>"       unified: memory + docs + gmail
swayam briefing               today's briefing
swayam weekly                 weekly review

swayam schedule add "<NL>"    add a cron automation
swayam schedule list/remove

swayam telegram start         long-running bot + scheduler
swayam daemon start           long-running scheduler (+ telegram if configured)
```

### Run as a background daemon (macOS)

To have schedules fire reliably without keeping a terminal open:

```bash
bash scripts/launchd/install.sh
# logs land in data/daemon.{out,err}.log
# uninstall: bash scripts/launchd/install.sh --uninstall
```

## Project layout

```text
config/                       editable behaviour
  SOUL.md  IDENTITY.md  AGENTS.md  TOOLS.md  USER.md
src/
  cli/                        one file per subcommand
  orchestrator/               context-builder · prompt-assembler · tool-router · loop
  llm/                        echo · anthropic · huggingface  (one interface)
  memory/                     daily-log · long-term · recall · distill · workspace
  tools/                      drop a file, restart, it's registered
  docs/                       ingest · TF-IDF store · chunker
  scheduler/                  nl-to-cron · persistent cron registry
  briefing/                   daily · weekly
  integrations/               gogcli · telegram
data/                         runtime state, gitignored
  memory/                     MEMORY.md + YYYY-MM-DD.md
  workspaces/                 per-workspace memory + documents
  sessions/                   JSONL traces, one per chat session
```

For the deeper write-up and what was deliberately changed from the project's architectural inspiration, see [ARCHITECTURE.md](ARCHITECTURE.md). For what's intentionally minimal in this first cut, see [ROADMAP.md](ROADMAP.md).

## Why I built it

I wanted an assistant whose memory I could read. If a recommendation is going to influence what I do, I should be able to grep the reasoning. I wanted it to stay on one machine — my data doesn't need a cloud round-trip to be useful. I wanted it to stop at confirmations: `gmail_send` will draft happily but never send without my "yes". And I wanted it small enough to hold in my head. One orchestrator, one tool loop, no swarms. There are bigger personal-assistant projects with more reach. This one prioritises legibility.

## Honest about v1

- RAG is TF-IDF over a JSON file, not vector embeddings. Fine to a few thousand chunks; the embedding upgrade is on the roadmap.
- Telegram confirmations are text replies, not inline buttons.
- Schedules need a long-running parent process. No launchd unit yet.
- HuggingFace tool calling is emulated with a JSON envelope in the system prompt — reliable on Llama-3.1-8B+ class models, flaky on tinier ones.
- Single user. Single machine. By design.

## License

MIT.
