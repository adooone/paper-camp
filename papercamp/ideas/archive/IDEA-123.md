---
id: IDEA-123
title: Cross-corpus idea links
type: feat
status: dropped
created: 2026-08-04
updated: 2026-08-14
tags:
  - multi-project
  - format
subject: Multi-project
---

`[[project:IDEA-N]]` as a resolvable reference between corpora. Multi-project owners already do this by hand: func-ui's corpus filed a paper-camp bug ([[IDEA-116]]) and the two reference each other only as prose. With the hub ([[IDEA-117]]) both corpora are open in one process, so resolution and backlinks are cheap; single-project mode renders them as plain text gracefully.

Format-level addition (a link syntax, not an app feature), so it belongs to the documented schema of Horizon 4's **format as the product**.

### Phases
- [ ] Document the `[[project:IDEA-N]]` syntax in the format schema
- [ ] Extend the link parser to recognize the project-scoped form
- [ ] Resolve project links against the open corpora in the hub
- [ ] Surface cross-corpus backlinks on the referenced idea
- [ ] Render project links as plain text in single-project mode

### Thread
- [x] 2026-08-14 [decision] [agent] Dropped: strictly downstream of [[IDEA-117]], which is itself parked on unanswered product decisions, and this idea's own body concedes that without the hub `[[project:IDEA-N]]` renders as plain text — which is what prose already does today. Parked since 2026-08-04 with no standalone value. Revisit if and when the hub's shape is settled; the reserve-the-syntax-in-the-parser fragment belongs to [[IDEA-168]] if it is ever wanted early.
