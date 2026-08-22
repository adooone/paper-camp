---
id: IDEA-117
title: Multi-project hub
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-04
updated: 2026-08-21
tags:
  - multi-project
  - app
subject: Multi-project
---

Graduates Horizon 3's **Multi-project** bullet. Paper Camp shows every registered project in one desk instead of one browser tab per repo — a project switcher, and cross-project views on top of it. The data stays per-repo in git: never centralize the corpus, centralize only the lens.

The hub is a client, not a process. [[IDEA-195]] settles one runtime per repository, so `paper-camp dev` in each repo stays exactly what it is — the architecture rather than a fallback — and the client fans out across as many runtimes as the user has registered. N ports still exist; the user never sees them.

A project is registered, never discovered. The client keeps a device-local list of runtime addresses in browser storage, each with the pairing token from its runtime, and a project enters it when its runtime announces itself: `paper-camp dev` prints a registration link. A project imported from GitHub joins the same registry with no runtime at all. Folder scanning is dropped — a repo-scoped runtime has no business reading disk outside its repo, and a client cannot read disk at all. GitHub import later adds runtime-less entries to the same registry, which [[IDEA-195]] sequences after this.

The shell that opens on the projects list is [[IDEA-205]]; this idea owns what sits behind it — what a registry entry is, how runtimes are queried, and where a user goes after choosing a project. What the switcher unlocks is cross-project views: everything-in-review across projects, all agent activity overnight, global idea search. Each is a fan-out — the client asks every reachable runtime and composes the answers, falling back to GitHub for a project that has no runtime up — so an absent runtime narrows what a project can do rather than removing it from the desk. Because the data is git, any machine that can pull reconstructs the whole desk.

Engineering note: fanning out means meeting runtimes at different paper-camp versions, and the skew moved. [[IDEA-168]] gave the corpus an explicit format version and made unknown frontmatter keys round-trip instead of being dropped on write, and the doctor ([[IDEA-121]]) reports a corpus newer than the running paper-camp — but each runtime parses its own corpus, so that end is covered. What this needs instead is the frozen HTTP contract from [[IDEA-195]] and a version each runtime reports, so the client flags a skew rather than silently mis-rendering.

Waits on [[TICKET-1]] and [[TICKET-2]]: pairing the client to a runtime, and detaching the client so it takes a runtime URL. A registered project whose runtime is unreachable is not a hole in the hub — it shows as plan-only, which [[IDEA-195]] settles as a first-class state, so the switcher is useful before every runtime is up. Companion captures: [[IDEA-118]] (decisions inbox), which has since shipped. [[IDEA-123]] (cross-corpus links) was dropped.

### Phases
- [ ] Register projects by runtime address
      Add, rename and remove runtime URLs; persist the registry in device-local browser storage.
- [ ] Announce a runtime from the CLI
      `paper-camp dev` prints a registration link that adds itself to the client's registry.
- [ ] Fan out across registered runtimes
      Read every reachable runtime in parallel; show an unreachable one as plan-only rather than missing, and flag version skew.
- [ ] Build the project switcher
- [ ] Ship cross-project views
      Everything-in-review, overnight agent activity, and global idea search composed from the fan-out.

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Explicitly waits on TICKET-1 and TICKET-2 for pairing/detach, and the shell it renders is IDEA-205, so it must follow both
