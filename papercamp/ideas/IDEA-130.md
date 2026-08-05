---
id: IDEA-130
title: Paper Scout — the conversational agent
type: feat
status: planned
created: 2026-08-05
tags:
  - agents
  - chat
  - integration
subject: In-app dev toolbar
---

Extracted from the toolbar design ([[IDEA-128]]) — the chat outgrew a segment. **Paper Scout** is the project's existing bot identity (the Scout GitHub App already opens draft PRs and cuts releases); this idea gives the same persona a conversational surface, so one scout handles both git chores and dialogue.

Design (decided on [[IDEA-128]], carried here):

- **Thread-verbatim**: Scout's chat rides the existing per-idea Feedback thread — messages are corpus thread messages of a new collapsible `chat` kind. Thread = chat history; nothing lives outside git. No session-style side channel.
- **Distillation is first-class**: outcomes get promoted to durable kinds (decision / idea / log) in-chat, plus an automatic one-line summary when a session goes quiet. Ephemeral conversation, durable conclusions.
- **Questions inbox folded in**: parked agent questions ([[IDEA-118]]) render in the same surface; the badge counts open questions project-wide; the panel triages oldest-first grouped by idea; replying resumes parked runs ([[IDEA-125]]).
- **Capture is a chat capability**: "note this down as an idea" files through guarded corpus writes ([[IDEA-122]]) — no capture form anywhere.
- **Context injection**: the mount supplies ambient context silently — in-app (toolbar) that's the current route/URL; on the desk it's the open idea.
- **Two mounts**: the desk's Feedback panel (today's UI, renamed and upgraded) and the toolbar's Scout segment ([[IDEA-128]] v2).

### Phases
- [x] Add the `chat` thread-message kind
      Serializer + types + collapsible rendering in thread views; existing feedback messages migrate or stay as-is per kind.
- [x] Give the feedback agent the Scout persona and project-wide scope
      Name, tone, and the ability to answer about any idea (not just the bound one) with idea-scoped default.
- [x] Fold the questions inbox into the chat surface
      Project-wide open-question badge, oldest-first triage grouped by idea, inline reply wired to run resumption.
- [ ] Add distillation actions
      In-chat promotion to decision/idea/log + auto-summary on session quiet.
- [ ] Define the context-injection contract for mounts
      A small interface the desk and toolbar both feed (route/URL, focused idea, viewport) — consumed silently by Scout.
- [ ] Expose Scout as the toolbar mount
      The [[IDEA-128]] v2 segment consumes this; toolbar work stays in that idea.

### Log
- 2026-08-05 — Extracted from [[IDEA-128]] by owner decision; named Paper Scout to unify with the existing Scout GitHub App identity — one bot for git chores and conversation.
