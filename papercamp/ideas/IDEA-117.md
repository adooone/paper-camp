---
id: IDEA-117
title: Multi-project hub
type: feat
status: idea
created: 2026-08-04
updated: 2026-08-21
tags:
  - multi-project
  - app
subject: Multi-project
order: 1
---

Graduates Horizon 3's **Multi-project** bullet. Paper Camp shows every registered project in one desk instead of one browser tab per repo — a project switcher, and cross-project views on top of it. The data stays per-repo in git: never centralize the corpus, centralize only the lens.

The hub is a client, not a process. [[IDEA-195]] settles one runtime per repository, so `paper-camp dev` in each repo stays exactly what it is — the architecture rather than a fallback — and the client fans out across as many runtimes as the user has registered. N ports still exist; the user never sees them.

A project is registered, never discovered. The client keeps a device-local list of runtime addresses in browser storage, and a project enters it when its runtime announces itself: `paper-camp dev` prints a registration link. Folder scanning is dropped — a repo-scoped runtime has no business reading disk outside its repo, and a client cannot read disk at all. GitHub import later adds runtime-less entries to the same registry, which [[IDEA-195]] sequences after this.

What the switcher unlocks is cross-project views: everything-in-review across projects, all agent activity overnight, global idea search. Each is a fan-out — the client asks every reachable runtime and composes the answers — so a project whose runtime is down is shown as unavailable rather than dropped. Because the data is git, any machine that can pull reconstructs the whole desk.

Engineering note: fanning out means meeting runtimes at different paper-camp versions, and the skew moved. [[IDEA-168]] gave the corpus an explicit format version and made unknown frontmatter keys round-trip instead of being dropped on write, and the doctor ([[IDEA-121]]) reports a corpus newer than the running paper-camp — but each runtime parses its own corpus, so that end is covered. What this needs instead is the frozen HTTP contract from [[IDEA-195]] and a version each runtime reports, so the client flags a skew rather than silently mis-rendering.

Blocked on two things [[IDEA-195]] sequences ahead of it: pairing auth on the runtime, and a client detached from any one runtime. Those are prose steps on a note today, so nothing tracks them — [[IDEA-201]] turns that sequence into tickets this can point at. Companion captures: [[IDEA-118]] (decisions inbox), which has since shipped. [[IDEA-123]] (cross-corpus links) was dropped.

### Phases
- [ ] Register projects by runtime address
      Add, rename and remove runtime URLs; persist the registry in device-local browser storage.
- [ ] Announce a runtime from the CLI
      `paper-camp dev` prints a registration link that adds itself to the client's registry.
- [ ] Fan out across registered runtimes
      Read every reachable runtime in parallel; surface unreachable ones as unavailable and flag version skew.
- [ ] Build the project switcher
- [ ] Ship cross-project views
      Everything-in-review, overnight agent activity, and global idea search composed from the fan-out.

### Thread
- [x] 2026-08-21 [log] [agent] It explicitly states it is blocked on two things IDEA-193 sequences ahead of it (pairing auth, a detached client) and wants those steps tracked as tickets from IDEA-201, so it must come last.
- [x] 2026-08-21 [log] [agent] Explicitly blocked on IDEA-195's (now IDEA-193/201) pairing-auth and detached-client steps, so it must sit last among these until that foundation lands.
- [x] 2026-08-21 [log] [agent] Explicitly blocked on the two steps IDEA-195/193 sequences ahead of it (pairing auth, a detached client), so it can only proceed once those land.
