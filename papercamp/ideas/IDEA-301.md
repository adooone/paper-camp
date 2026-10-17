---
id: IDEA-301
title: Chat sounds like Scout
type: feat
status: planned
created: 2026-10-16
tags:
  - app
  - ui
  - server
subject: App UI
order: 8
---

The prompts already say "You are Paper Scout", but the Chat page shows none of
that. Every message renders through `FeedbackThread`, the idea page's thread
component: Scout's replies wear an "agent" stamp, the only timestamp is a
date, chat messages clamp to one line behind *Show more*, a parked question
without options is a plain card with no reply field, and `[[IDEA-N]]` in a
reply is literal brackets with nothing to click. Opening the page scrolls the
last message to the viewport's edge and leaves the composer below it, Enter
inserts a newline, the empty state is a doodle over "No messages yet.", and
the scope sidebar IDEA-293 specified never shipped (`hasSidebar` omits
`isChatArea`). The thread merge across projects sorts by `date`, which is a
day, so same-day messages from two projects never interleave. This idea makes
the page read as a conversation with Scout.

**Messages carry a time.** The thread grammar's entry anchor accepts an
optional `THH:MM` after the date, so `- [x] 2026-10-16T14:05 [chat] …` parses;
`ThreadMessage.date` keeps the string verbatim. `serialize` gains
`nowMinuteString()`, and every write to `papercamp/chat.md` (the chat route's
user and reply messages, the parked question copy in `agent.ts`) uses it.
Entity threads keep `todayDateString()`. A line without a time parses as
before. `mergeScopedChatMessages` sorts by the full string, so same-day
messages interleave at minute precision and an old date-only line sorts at the
start of its day. `formatChatFile` writes the anchor back unchanged.

**Scout has a name and a face.** `src/app/features/chat/views/chat-message.tsx`
replaces `FeedbackThread` on the page. A Scout message shows folk-ui's `Avatar`
(`name="Scout"`, `size="small"`) at the left of a kraft card, with a meta line
above the card reading *Scout · 14:05*, plus the `ProjectChip` when more than
one project is in scope. A user message is right-aligned on parchment with a
meta line of the time alone. A `question` renders `QuestionCard` whether or not
it has options: with none, the card shows only the free-text reply field. A
resolved question shows a small *answered* stamp and no field. Chat messages
never clamp. The *question* stamp, the *agent* stamp, undo and promote are
gone from this page.

**Ideas are links.** `src/app/features/chat/views/entity-link-text.tsx` renders
message text with every `[[IDEA-N]]` and bare `IDEA-N` as a link to
`/ideas/$ideaId` labelled `IDEA-N · title` when the ideas query knows the
title, `IDEA-N` otherwise. Scout's action replies lead with the verb:
`chat-reply.ts` returns `Filed [[IDEA-N]] — title.`, `Posted to [[IDEA-N]]:
<reply>` and `Posted to [[IDEA-N]], but the reply failed: <error>`.
`buildChatMovePrompt` adds to its rules: answer in at most three sentences,
name ideas by id, never restate the user's message.

**The empty state greets.** Copy only, no doodle: *Hi — I'm Scout. Tell me
about work and I'll file it as an idea, mention an idea and I'll post there,
or ask what's running.* Under it three ghost buttons that fill the composer
and focus it: *What's running right now?*, *What's waiting on me?*, *File an
idea for …*. The page title reads *Scout*; the header tab stays *Chat*.

**The page is a chat.** The thread is its own scroll container filling the
column under the title row, and the composer is pinned under it, always
visible. Opening scrolls to the newest message. A message landing scrolls to
it when the view was within 80 px of the bottom; otherwise a *New messages*
pill at the thread's bottom edge scrolls there on tap. Enter sends,
Shift+Enter inserts a newline, and the composer keeps focus after a send. The
*N unanswered* stamp leaves the title row (the tab carries the count); *Clear
chat* stays.

**The scope sidebar.** `hasSidebar` includes `isChatArea`, so Chat shows the
scope list with each project's unanswered count, as IDEA-293 specified. The
composer's *in <project>* picker stays.

Done when a reply from Scout shows the avatar, the name and the time, idea
ids in it open the idea, a question parked without options can be answered on
the page, Enter sends, the composer is on screen when the page opens, the
empty page greets, and the scope list is beside the thread.

### Out of scope

The thinking, failed and retry states and live updates ([[IDEA-302]]).
Streaming reply text. Message search, editing or deleting one message. The
embedded toolbar's chat mount.

### Phases
- [x] Minute-precision chat timestamps
      `THH:MM` accepted by the thread entry anchor and written back verbatim;
      `nowMinuteString()` in `serialize`; the chat route and the parked question
      copy write it; `mergeScopedChatMessages` sorts on the full string; tests
      for parse, format, sort and a date-only line.
      run: 3m20s · 84 in · 12.4k out · sonnet-5 · sess:a333bfbb-3834-4a07-85d7-74b768c38354
- [x] A ChatMessage component with Scout's avatar
      `chat-message.tsx` and `entity-link-text.tsx` under
      `features/chat/views/`; the page renders every message through them;
      `QuestionCard` answerable without options and marked when resolved; no
      clamp, no agent, question,
      undo or promote affordances; tests for the link parsing and the question
      states.
      run: 6m48s · 156 in · 38.9k out · sonnet-5 · sess:a333bfbb-3834-4a07-85d7-74b768c38354
- [ ] Scout's replies lead with the verb
      `chat-reply.ts` wording for the three moves and the three prompt rules in
      `buildChatMovePrompt`; tests updated.
- [ ] The page as a chat
      Thread scroll container with the pinned composer, open-to-newest and
      near-bottom auto-scroll with the *New messages* pill, Enter sends and
      Shift+Enter newline, focus kept after send, title *Scout*, the greeting
      empty state with its three buttons, the unanswered stamp removed from the
      title row; tests for the scroll decision and the key handling.
- [ ] The scope sidebar on Chat
      `hasSidebar` includes `isChatArea`; the scope list renders on `/chat` with
      unanswered counts; `use-app-shell.test.ts` covers it.
