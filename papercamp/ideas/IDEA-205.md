---
id: IDEA-205
title: Hub shell and projects list
type: feat
status: idea
created: 2026-08-21
updated: 2026-08-21
tags:
  - app
  - multi-project
  - github
subject: Multi-project
---

The hosted client opens on nothing today — the app assumes it is already inside one repo. The shell is what a URL with no project behind it must show: a welcome screen, a way to sign in to GitHub, and the list of projects to enter.

It is the outermost frame, and it owns the moment before a project is chosen. [[IDEA-117]] owns everything after: what a registry entry is, pairing, fanning out across runtimes, cross-project views, and switching between projects without returning here. The shell renders the registry; it does not decide what goes in it. Keeping that line means the shell ships while the hub's machinery is still being built.

**Welcome.** First run has an empty registry and no token, so the screen has exactly two things to offer: sign in to GitHub, or add a project by its runtime URL. It must read as a starting point rather than an error, because an empty desk is the normal state of a new install.

**Sign in.** GitHub via device flow or PKCE, as [[IDEA-195]] settles — the token is obtained from the user's own authorization, kept in device-local storage, and never seen by any Paper Camp service. [[IDEA-193]] owns acquiring and refreshing it; the shell owns the surface: signing in, showing who is signed in, and signing out.

**Projects list.** One row per registry entry, of either kind: a project whose runtime announced itself, and a project imported from GitHub with no runtime at all. Each row says which it is, because that is what decides whether the project can execute or only plan. A runtime that stops answering moves its project to plan-only rather than removing it — plan-only is a first-class state, not a failure.

Signed out with no runtimes registered, the shell is still honest: it shows the welcome screen. It never presents an empty desk as though something went wrong.

### Phases
- [ ] Build the shell frame
      The outermost layout the hosted client opens into, with the app mounting inside it once a project is chosen.
- [ ] Welcome screen for an empty desk
      Sign in to GitHub, or add a project by runtime URL, presented as a starting point rather than an error.
- [ ] GitHub sign-in surface
      Sign in, show the signed-in identity, sign out, against the token mechanism [[IDEA-193]] provides.
- [ ] Projects list
      One row per registry entry, runtime-backed or GitHub-imported, each showing whether it can execute or only plan.
- [ ] Enter and leave a project
      Choose a project to mount the desk against it, and return to the shell without losing the registry.
