---
id: IDEA-271
title: A page for a review finding
type: feat
status: idea
created: 2026-09-15
tags:
  - app
  - ui
  - plans
subject: App UI
order: 3
---

One pass filed 26 findings, and the Ideas page shows them as a list of
one-line rows whose only actions are dismiss and a promote modal. A
finding carries more than a line — a check, a chunk, a file and line, the
commit it was found at, a severity, and a paragraph of reasoning — and
deciding what to do with it means reading all of that, which a row cannot
show and a modal shows badly: it covers the list, it cannot be linked to,
and it offers one verb.

**A finding opens as a page.** `/findings/$findingId` renders like an idea
detail and is reached by clicking the row, with the id derived from the
finding's date, file and line so the URL survives a reload. The head card
carries the check and severity stamps, the chunk, and `file:line` in mono;
the body is the finding's own text; a facts grid gives the commit it was
found at, the date, and whether the file has changed since. The Ideas
page's group keeps its rows and loses its modal.

**Two verbs, both on the page's bottom bar.** *Promote* makes an idea from
the finding exactly as the modal does today, and lands on the new idea.
*Fix it here* launches an agent task with the finding as its prompt — the
same `issue-fix` shape the checks group uses — and the page shows that
task's card while it runs, then its outcome. A fixed finding is removed
from `suggestions.md` when the task lands green, the way a promoted one is
removed when its idea is created. *Dismiss* stays, quiet, beside them.

**The list gets what a list needs.** The group's rows show severity, check
and `file:line`, sorted critical first then by file, and collapse per
chunk once a date carries more than ten — 26 rows in one flat list is the
shape that made this hard to read.

### Out of scope

The night gate and what the checks look for. Editing a finding's text.
Any change to how promote builds its idea.

### Phases
- [x] Give a finding a stable id and a lookup
      Derive the id from date, file and line the way `nightFindingKey` already does, and
      expose a by-id finder on the night report slice.
      run: 2m30s · 54 in · 7.5k out · sonnet-5 · sess:e7d7963f-9837-450e-aa1d-beb36e8048c5
- [x] Add the `/findings/$findingId` route and page
      Head card with stamps, chunk and `file:line`, the finding's text as the body, and a
      facts grid of commit, date and the staleness the reader already computes.
      run: 6m17s · 136 in · 23.7k out · sonnet-5 · sess:e7d7963f-9837-450e-aa1d-beb36e8048c5
- [x] Move promote and dismiss onto the page's bottom bar
      Reuse `promoteNightFinding` and the dismiss action, landing on the new idea.
      run: 2m11s · 62 in · 11k out · sonnet-5 · sess:fb5e9cdf-d079-46e3-a601-71a98b919e7a
- [ ] Add "Fix it here"
      Launch an `issue-fix` task with the finding as its prompt, render its card on the
      page, and drop the line from `suggestions.md` when it lands green.
- [ ] Rework the group's rows and drop the modal
      Rows open the page and show severity, check and `file:line`, sorted critical first
      then by file, collapsing per chunk past ten.
