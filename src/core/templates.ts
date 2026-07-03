/**
 * Static file contents scaffolded by `paper-camp init` for the Claude Code
 * native integration: the discoverable skill, the SessionStart/PostToolUse
 * hook wiring, and the git post-commit hook. Kept in one place so `init`'s
 * no-clobber writes stay simple string dumps.
 */

export const SKILL_MD_CONTENT = `---
name: paper-camp
description: Work inside a project that has a papercamp/ folder — its per-file plans, ideas, decisions log, open questions, and progress log. Use this whenever the working directory contains papercamp/ (papercamp/plans/, papercamp/ideas/, papercamp/decisions.md, papercamp/open-questions.md, papercamp/progress.md), and especially before starting, continuing, or completing any plan phase, drafting an idea, logging a decision, or answering "what are we working on / what's next".
---

# Paper Camp

Paper Camp is this project's planning methodology: plans, ideas, decisions, and
open questions live as markdown files under \`papercamp/\`, and an append-only
\`papercamp/progress.md\` is the changelog. This skill tells you how to read that
state before acting and how to keep it honest as you work.

If a \`papercamp\` MCP server is connected in this session, prefer its tools
(list/get plans, update phase, append progress, etc.) over raw file access —
they enforce the same guards (id allocation, branch conflicts) that the file
grammar below assumes. Everything in this skill still applies conceptually;
only the mechanism changes.

## Before doing any work

Read, in this order, whatever exists:

1. \`papercamp/plans/index.md\` — every plan's id/title/status/tags, at a glance.
2. The specific plan file at \`papercamp/plans/<ID>.md\` (e.g. \`FEAT-31.md\`) for
   the plan you're about to work on. Each plan is YAML frontmatter (\`id\`,
   \`title\`, \`kind\`, \`status\`, \`tags\`, ...) plus prose, then a \`### Phases\`
   list of \`- [ ]\`/\`- [x]\` checkboxes with an indented description under each.
3. \`papercamp/ideas/index.md\` and any linked idea file — plans often trace
   back to an \`idea:\` field; the idea explains *why*, the plan explains *what*.
4. \`papercamp/decisions.md\` — settled calls that constrain your approach.
   Don't re-litigate a logged decision without flagging it to the user first.
5. \`papercamp/open-questions.md\` — unresolved questions that might block or
   redirect the work you're about to start.
6. The last handful of entries in \`papercamp/progress.md\` for recent context
   on what just happened.

Skip files that don't exist yet (a fresh project may have empty logs).

## While working

- Work one plan phase at a time unless told otherwise — don't cascade into
  later phases just because they look quick.
- If a phase's boundary or intent is unclear, ask before continuing.
- Prose in plans and ideas is more current than your memory of past
  conversations. If they conflict, the files win — say so and resync.

## Keep the project current as you go

- **Plan phases**: when you finish a phase, flip its checkbox from \`- [ ]\` to
  \`- [x]\` in the plan's frontmatter file. Change only that line — don't touch
  other phases or prose.
- **Plan status**: keep the plan's \`status:\` frontmatter honest
  (\`planned\` / \`in-progress\` / \`review\` / \`done\`). When every phase is
  checked, set status to \`review\` — never \`done\`. \`done\` is a human-only
  promotion after review; an agent finishing the last phase does not close
  the plan itself.
- **Progress log**: add one bullet describing what you did under today's
  \`## YYYY-MM-DD\` heading at the top of \`papercamp/progress.md\` (newest day
  first; create the heading if today's isn't there yet). Be specific enough
  that a future read of the log alone explains what changed and why, without
  needing to re-read the diff.
- **Decisions / open questions**: if you settle something ambiguous while
  working, log it in \`papercamp/decisions.md\`; if you surface a question you
  can't resolve yourself, add it to \`papercamp/open-questions.md\` rather than
  guessing silently.

## What this skill deliberately does not do

It does not maintain a separate "current focus" file — that's derived at
session start from live plan/progress data, not hand-maintained here. It does
not define the file formats in full; treat the existing files under
\`papercamp/\` as the grammar reference (mirror their structure exactly rather
than inventing a new shape).
`;

const PAPER_CAMP_BIN = '$CLAUDE_PROJECT_DIR/node_modules/.bin/paper-camp';

export const CLAUDE_SETTINGS_JSON = `${JSON.stringify(
  {
    hooks: {
      SessionStart: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: `"${PAPER_CAMP_BIN}" session-focus` }],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Write',
          hooks: [{ type: 'command', command: `"${PAPER_CAMP_BIN}" post-tool-use-log` }],
        },
      ],
    },
  },
  null,
  2,
)}\n`;

export const POST_COMMIT_HOOK_SCRIPT = `#!/bin/sh
# Installed by \`paper-camp init\` — logs each commit to papercamp/progress.md.
BIN="$(git rev-parse --show-toplevel)/node_modules/.bin/paper-camp"
[ -x "$BIN" ] && "$BIN" log-commit
exit 0
`;
