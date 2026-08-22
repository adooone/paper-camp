---
id: IDEA-205
title: Hub shell and projects list
type: feat
kind: ticket
status: review
idea: IDEA-195
created: 2026-08-21
updated: 2026-08-22
tags:
  - app
  - multi-project
  - github
subject: Multi-project
order: 1
---

The hosted client opens on nothing today — the app assumes it is already inside one repo. The shell is what a URL with no project behind it must show: a welcome screen, a way to connect GitHub, and the list of projects to enter.

It is the outermost frame, and it owns the moment before a project is chosen. [[IDEA-117]] owns everything after: what a registry entry is, pairing, fanning out across runtimes, cross-project views, and switching between projects without returning here. The shell renders the registry; it does not decide what goes in it. Keeping that line means the shell ships while the hub's machinery is still being built.

**Welcome.** First run has an empty registry and no token, so the screen has exactly two things to offer: connect GitHub, or add a project by its runtime URL. It must read as a starting point rather than an error, because an empty desk is the normal state of a new install.

**Connect GitHub.** The user mints a fine-grained token and pastes it in, as [[IDEA-195]] settles — device flow cannot complete in a browser, and the shim that would fix it is the backend this architecture refuses. The shell owns that surface: taking the token, naming which repositories it reaches, showing the connected identity, and disconnecting. It has to carry the minting instructions well, because this is the one step where the no-backend choice is visible to the user.

**Projects list.** One row per registry entry, of either kind: a project whose runtime announced itself, and a project imported from GitHub with no runtime at all. Each row says which it is, because that is what decides whether the project can execute or only plan. A runtime that stops answering moves its project to plan-only rather than removing it — plan-only is a first-class state, not a failure.

Disconnected with no runtimes registered, the shell is still honest: it shows the welcome screen. It never presents an empty desk as though something went wrong.

### Phases
- [x] Build the shell frame
      The outermost layout the hosted client opens into, with the app mounting inside it once a project is chosen.
      run: 4m34s · 6.1k in · 13.5k out · sonnet-5
- [x] Welcome screen for an empty desk
      Connect GitHub, or add a project by runtime URL, presented as a starting point rather than an error.
      run: 6m53s · 650 in · 26.5k out · sonnet-5
- [x] GitHub connect surface
      Take a user-minted fine-grained token with clear minting instructions, show the connected identity, and disconnect.
      run: 4m20s · 2.6k in · 13k out · sonnet-5
- [x] Projects list
      One row per registry entry, runtime-backed or GitHub-imported, each showing whether it can execute or only plan.
      run: 5m40s · 515 in · 19.5k out · sonnet-5
- [x] Enter and leave a project
      Choose a project to mount the desk against it, and return to the shell without losing the registry.
      run: 4m35s · 652 in · 12.6k out · sonnet-5
- [x] [manual] Recognize a runtime-served bundle as a chosen project
- [x] [manual] Move projects hub to its own full-window route
- [x] [manual] Paginate GitHub repo listing for token reach

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Fourth sequencing step; needs the hosted deploy from IDEA-204 to have a URL with no project behind it to open
- [x] 2026-08-22 [review] [agent] Comments · 2 findings — The diff cleanly delivers the shell frame, welcome screen, GitHub-connect surface, runtime-served-bundle detection, and the /projects route, with good service-layer separation and solid unit tests. The one substantive gap is the projects list, which only renders runtime entries and unconditionally stamps them 'Can execute' — the plan-only and GitHub-imported states the spec calls first-class are absent — but that machinery is explicitly delegated to IDEA-117, so it reads as intentional deferral rather than a contradiction. A minor real bug is the un-paginated repo fetch producing an undercount on tokens reaching more than 100 repositories.
