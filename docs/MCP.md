# MCP Server

Paper Camp ships a [Model Context Protocol](https://modelcontextprotocol.io) server so any MCP
client — Claude Code, Claude Desktop, Cursor, or anything else that speaks MCP — can read and
write a `papercamp/` project through a standardized interface instead of raw file access.

The server is a thin wrapper: every tool routes through the same `src/core` readers/serializers
the CLI and dashboard already use, so id allocation, archive-on-done, and index regeneration all
still hold, and plan-advancing writes (`draft_plan`, `update_phase`) enforce the same
"one active plan per branch" guard the dashboard does.

## Running the server

The server runs over stdio and reads/writes the `papercamp/` project rooted at the current
working directory:

```bash
paper-camp mcp
```

## Registering with a client

Add an entry pointing at the installed `paper-camp` binary, with `cwd` set to the project root
whose `papercamp/` folder you want the server to operate on. For example, in a client config
that uses the common `mcpServers` shape (Claude Desktop, Claude Code's `.mcp.json`, etc.):

```json
{
  "mcpServers": {
    "paper-camp": {
      "command": "paper-camp",
      "args": ["mcp"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

## Tools

### Read

**`list_plans`**
List all plans (per-file and monolithic, merged), with parse warnings.
No arguments.

**`get_plan`**
Fetch a single plan by id.
- `id` (string) — plan id, e.g. `FEAT-32`

**`list_open_questions`**
List all open questions with their status, with parse warnings.
No arguments.

**`list_decisions`**
List all logged decisions, with parse warnings.
No arguments.

### Write

**`add_idea`**
Create a new per-file idea entry and regenerate the ideas index.
- `title` (string) — idea title
- `content` (string, optional) — idea body (markdown)

**`draft_plan`**
Create a new per-file plan entry, assigning it the next id for its kind. Rejected if the
current branch already has an unfinished plan (`checkBranchConflictForPlan`).
- `title` (string) — plan title
- `content` (string, optional) — plan body (markdown)
- `kind` (string, optional) — plan kind (`feat`, `fix`, ...), defaults to `feat`

**`update_phase`**
Toggle a plan phase done/not-done by index, optionally updating the plan status (archiving it
if the new status is `done` or `dropped`). Rejected if it would start or advance a plan other
than the branch's own unfinished plan (`checkBranchConflictForPlan`).
- `id` (string) — plan id, e.g. `FEAT-32`
- `phaseIndex` (number) — 0-based index into the phases list
- `done` (boolean)
- `status` (string, optional) — new plan status

**`append_progress`**
Prepend a bullet under today's heading in `progress.md`.
- `item` (string) — progress bullet text, without the leading `- `

**`resolve_open_question`**
Resolve an open question, logging the resolution as a new decision.
- `title` (string) — open question title
- `decision` (string) — the decision that resolves it
- `rationale` (string, optional) — rationale to log alongside the decision

