---
id: TICKET-5
title: Plugins as a real extension point
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-21
tags:
  - plugins
  - extensibility
  - adapters
subject: Multi-project
order: 13
---

The last sequencing step on [[IDEA-195]].

### Phases
- [ ] Define the plugin contract for both kinds
      A plugin declares its kind — external service or local adapter — the capability it provides, its trust boundary, and how it reports availability, against the layer contract from [[TICKET-3]].
- [ ] Register and resolve plugin availability
      Give the client a registry of installed plugins so [[TICKET-3]]'s per-plugin reachability reads from a real source rather than a hard-coded probe.
- [ ] Retrofit today's plugins onto the contract
      Express GitHub-via-`gh` as an external service and `claude-code`/`opencode` as local adapters through the same declaration, replacing their ad-hoc wiring.
- [ ] Let a module depend on a named plugin
      Extend the capability gate so a module can require a specific plugin and go inert in place with a plain reason when it is absent.
- [ ] Document adding a plugin
      Write the steps to add a new external service or adapter so a third one lands without touching core.

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Last named sequencing step on IDEA-195's chain, lowest priority of the ordered list
