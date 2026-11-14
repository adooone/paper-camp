# Chat session file

The project chat is one long-lived agent session per checkout. The daemon keeps
the session's handle in `papercamp/.local/chat-session.json`, next to the other
per-checkout state under `papercamp/.local/` — ignored by git, never committed.
The conversation itself lives in `papercamp/chat.md`, which is committed and
shared; the session file only says which agent session carries it on this
machine.

## Shape

```json
{
  "sessionId": "473e0898-736b-42df-8d86-42a7d8cae5bf",
  "agent": "claude-code",
  "model": "fable"
}
```

| Field | Type | Meaning |
|---|---|---|
| `sessionId` | string | The agent's own session id: claude-code's `session_id`, resumed with `--resume <id>`; opencode's session, resumed with `run --session <id>` |
| `agent` | `"claude-code"` \| `"opencode"` | The agent that owns the session |
| `model` | string, optional | The model the session was started on; absent when the chat agent has no model set |

A file that is missing, not JSON, or lacks a string `sessionId` or `agent`
reads as no session.

## Lifecycle

- **Written** after every turn that reports a session id, so the file always
  names the latest session.
- **Resumed** on the next turn only when its `agent` and `model` match the
  chat entry of `defaultAgents` in `papercamp/config.json`. A mismatch (the
  agent or model was changed in Settings) starts a fresh session instead.
- **Replaced** when a resume fails before producing any output (an expired or
  unknown session): the turn starts a fresh session, re-sends the preamble
  and replays the last ten `chat.md` messages, then overwrites the file with
  the new id.
- **Deleted** by *Clear chat* (`DELETE /api/chat`), together with
  `chat.md`. Deleting it by hand is safe: the next message starts a fresh
  session with the preamble and the replay.

## What a turn sends

A fresh session's first turn is the preamble (persona, `AGENTS.md` and
`papercamp/` as the map, the MCP tools for idea writes, the rules for
editing code), the replay when there is one, then the turn. A resumed turn
is the turn alone:

```
Branch: main, dirty: src/app/server/git.ts
Active runs: IDEA-331 phase (phase 2)
The user is on /ideas/IDEA-331, looking at IDEA-331.

<the user's message>
```

The third line appears only when the message came with a mount context (the
toolbar's Scout card). The prompt is built by `buildChatTurnPrompt` in
`src/app/features/plans/prompts/prompts.ts`; the turn runs in `runChatTurn`
in `src/app/server/agent.ts`.
