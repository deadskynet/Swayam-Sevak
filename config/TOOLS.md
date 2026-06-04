# TOOLS.md

Available tools and their permissions. The tool router enforces the `requires_confirmation` flag.

| Tool                | Purpose                                            | Requires confirmation |
|---------------------|----------------------------------------------------|-----------------------|
| `gmail_search`      | Search the user's Gmail with a query string.       | no                    |
| `gmail_read`        | Fetch the body of a specific email by id.          | no                    |
| `gmail_draft`       | Create a draft email (does NOT send).              | no                    |
| `gmail_send`        | Send a previously drafted email.                   | **yes**               |
| `calendar_events`   | List upcoming or past calendar events.             | no                    |
| `calendar_create`   | Create a new calendar event.                       | **yes**               |
| `docs_search`       | Semantic search across ingested documents.         | no                    |
| `memory_search`     | Search MEMORY.md and recent daily logs.            | no                    |
| `workspace_files`   | Read files inside the active workspace directory.  | no                    |
| `schedule_create`   | Add a natural-language cron automation.            | **yes**               |
| `schedule_remove`   | Remove a scheduled automation.                     | **yes**               |
| `meeting_prep`      | Aggregate emails, notes, and docs for an event.    | no                    |

## Tool registration

Tools are auto-discovered from `src/tools/*.ts`. Each file exports a default `Tool` object. New tools are picked up on next start — no central registry to edit.

## Adding a tool

1. Create `src/tools/my-tool.ts` exporting a `Tool` whose `execute` returns a string or structured value.
2. Append a row to this table.
3. Restart the assistant.
