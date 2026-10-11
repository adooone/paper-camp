---
id: IDEA-293
title: Chat gets its own page
type: feat
status: planned
created: 2026-10-11
tags:
  - app
  - ui
  - multi-project
subject: App UI
order: 2
---

[[IDEA-290]] folded Chat into Activity: the composer sits above the run
stream, Scout messages are stream entries, and `/chat` redirects to
`/activity?kind=chat`. In use, a conversation and a run log want different
pages. A conversation reads top to bottom and needs a reply box where it
ends. A run log is filtered, sorted and scanned. Mixed together, the
composer pushes every run below the fold, a conversation has to be found
between run rows, and Activity's toolbar carries a kind switch that exists
only to undo the merge. Chat becomes its own page again. The header becomes
**Ideas · Activity · Chat · Project**, and Activity holds runs only.

**The Chat page, at `/chat`.** A new `src/app/features/chat/` holds the page.
The page title reads *Chat*. Its title actions are the unanswered-question
stamp (*2 unanswered*) and *Clear chat*, both moved from Activity. The thread
renders through `FeedbackThread`, oldest first, so a conversation reads top to
bottom. A Scout question is answered inline, as it is today. The composer sits
under the thread's last message. It is the card from `ActivityComposer`,
renamed `ChatComposer`, with *Send* and the *in* project picker from
[[IDEA-291]]. A sent message shows as the pending card until the reply lands.
Opening the page scrolls to the newest message. `use-chat-thread.ts`,
`ClearChatModal` and the composer move from `features/activity/` to
`features/chat/`. The page is a corpus route of its own in `router.tsx`, and
the `/chat` redirect is replaced by it.

**Chat across the scope.** The sidebar is the scope list on Chat too, as it
is on Ideas and Activity, and its count is each project's unanswered
questions. With more than one project in scope, the thread merges every
project's messages by time, and each message carries its `ProjectChip`. An
answer goes to the project that asked. *Clear chat* clears the current
project's chat only, and its modal names that project.

**The header.** `navItems` gains `{ id: 'chat', label: 'Chat', path: '/chat' }`
between Activity and Project. When the projects in scope have unanswered
Scout questions, the tab carries their count as a small warning `Stamp` after
the label. With none, there is no stamp. `useAppShell` gets an `isChatArea`
flag, `sidebarAreaKey` gets `'chat'`, and `/chat` joins
`ROW_SKELETON_PREFIXES`.

**Activity holds runs only.** The composer, the pending card, the chat
entries in the stream, the *All · Runs · Chat* chips, the `kind` search param,
*Clear chat* and the unanswered stamp leave Activity. `activityKind` and
`setActivityKind` go from `useActivityPage`, and `ActivityStream` renders run
rows alone. An old `/activity?kind=chat` link redirects to `/chat`, and
`?kind=runs` is dropped silently. Notification-click URLs that open a reply
(`notification:<id>` entries) open `/chat` instead of an Activity entry.

Done when the header shows four tabs, `/chat` shows the conversation with its
composer under the last message, and Activity shows no chat.

### Out of scope

Chat threads per idea. Message search. Editing or deleting a single message.
The embedded dev toolbar.

### Phases
- [x] Move the chat pieces into a Chat feature
      `features/chat/` with the thread hook, `ChatComposer` and
      `ClearChatModal` moved from Activity; the `/chat` route renders the page
      with title actions, the thread oldest first, the composer under it and
      scroll to the newest message.
      run: 4m2s · 80 in · 16.9k out · sonnet-5 · sess:44cd8bdb-911e-43f1-ae8c-a94b6b82774e
- [x] Merge chat across the scope
      Scope list sidebar with unanswered counts, the thread merged by time with
      project chips, answers routed to the asking project, Clear chat scoped to
      the current project.
      run: 4m53s · 72 in · 22.4k out · sonnet-5 · sess:44cd8bdb-911e-43f1-ae8c-a94b6b82774e
- [ ] Add the Chat tab to the header
      `navItems` entry with the unanswered stamp, shell area flag, sidebar key,
      skeleton prefix.
- [ ] Strip chat out of Activity
      Composer, chat entries, kind chips, `kind` param, Clear chat and the
      unanswered stamp removed; `?kind=chat` redirects to `/chat`; reply
      notifications open `/chat`; tests updated.
