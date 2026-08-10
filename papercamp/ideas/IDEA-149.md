---
id: IDEA-149
title: Feedback fixes start running at once
type: feat
status: idea
created: 2026-08-10
tags:
  - agents
  - plans
  - app
subject: Run & monitor
---

Posting feedback on a review idea makes the feedback agent record a fix
phase — and then everything stops, waiting for a human to press "Run
fixes". The suggestion was the instruction; the press is ceremony.

1. **The server launches the fixes run the moment one is recorded.**
   When a feedback-agent run completes having added a new open fix, the
   server fires the same run path as the "Run fixes" button — the fix
   phase still lands in the file first (it IS the record and the run's
   spec), so implementation starts in parallel with the reply appearing
   in the chat.

2. **Guarded like the button.** If an agent is already busy on that
   plan, nothing launches — the fix waits as an open phase and the
   button remains the manual path. No queue, no stacking.

3. **No loops.** Only fixes created by a feedback-agent run trigger the
   launch; a fixes run completing never re-triggers, whatever thread
   messages it posts.

4. **Scope: the fixes flow only.** Parked-question replies keep their
   existing resolve-and-resume behavior, which is already immediate
   ([[IDEA-96]]).

### Thread
- [x] 2026-08-10 [decision] Auto-run replaces the manual press as the default; the button survives as the fallback for the busy-agent case. The recorded phase stays the source of truth the run executes from.
