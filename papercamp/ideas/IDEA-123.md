---
id: IDEA-123
title: Cross-corpus idea links
type: feat
status: idea
created: 2026-08-04
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
