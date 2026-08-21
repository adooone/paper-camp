# MCP Server

Paper Camp ships a [Model Context Protocol](https://modelcontextprotocol.io) server so any MCP
client — Claude Code, Claude Desktop, Cursor, or anything else that speaks MCP — can read and
write a `papercamp/` project through a standardized interface instead of raw file access.

The server is a thin wrapper: every tool routes through the same `src/core` readers/serializers
the CLI and dashboard already use, so id allocation, archive-on-done, and index regeneration all
still hold. Every write tool runs through the same `checkBranchConflictForPlan` guard the
dashboard uses, so an MCP client cannot start or advance a plan the branch does not own, and
writes are serialized so concurrent stdio calls can't mint duplicate ids.

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

Every entity is an idea file at `papercamp/ideas/<ID>.md` with its plan as a `### Phases`
section, so ids are always `IDEA-N` and "plan" below means that same entity seen plan-shaped.

### Read

**`list_plans`**
List all work entities (plan-shaped view of the corpus), with parse warnings.
No arguments.

**`get_plan`**
Fetch a single work entity by its id.
- `id` (string) — entity id, e.g. `IDEA-43`

### Create

**`add_idea`**
Create a new idea entity (`status: idea`) and regenerate the index.
- `title` (string) — idea title
- `content` (string, optional) — idea body (markdown)

**`draft_plan`**
Create a new *typed* work entity (`status: idea`) with the next lifetime `IDEA-N` id.
- `title` (string) — entity title
- `content` (string, optional) — entity body (markdown)
- `kind` (string, optional) — work type (`feat`, `fix`, ...), defaults to `feat`

### Edit

**`edit_idea`**
Edit an existing entity in place — any of title, body, tags, or type. Omitted fields are
left untouched.
- `id` (string) — entity id
- `title` (string, optional) — new title
- `content` (string, optional) — new body (markdown), replacing the current body
- `tags` (string[], optional) — new tag list, replacing the current tags
- `type` (string, optional) — new work type

**`update_phase`**
Toggle a plan phase done/not-done by index, optionally updating the plan status. Archives the
entity only if the new status is `dropped`.
- `id` (string) — entity id
- `phaseIndex` (number) — 0-based index into the phases list
- `done` (boolean)
- `status` (string, optional) — new plan status

**`archive_entity`**
Drop an entity: set its status to `dropped` and move its file into the archive.
- `id` (string) — entity id

### Thread

Four tools with the same shape, one per message kind, so the thread grammar never has to be
written by hand. `append_decision` and `append_note` land in the `open` state.

**`append_log`** · **`append_clarification`** · **`append_decision`** · **`append_note`**
- `id` (string) — entity id
- `text` (string) — message text (markdown)

**`promote_thread_message`**
Distill one thread message in place into a durable decision or log entry, optionally
appending a breadcrumb note.
- `id` (string) — entity id
- `index` (number) — 0-based index into the entity thread
- `target` (string) — `decision` or `log`
- `note` (string, optional) — breadcrumb appended to the message text

### Promote

**`promote_suggestion`**
Mint an idea from a suggestion line in `suggestions.md` and remove that line.
- `title` (string) — suggestion title, matched against `suggestions.md`
- `date` (string, optional) — suggestion date (`YYYY-MM-DD`), to disambiguate a repeated title

**`promote_roadmap_item`**
Mint an idea from a roadmap item (or one of its candidates) in `ROADMAP.md`, linking it back
to the item.
- `horizonTitle` (string) — horizon heading the item lives under
- `itemName` (string) — roadmap item name
- `candidateName` (string, optional) — candidate under that item
- `subject` (string, optional) — subject override for the new idea
