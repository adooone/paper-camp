---
id: IDEA-289
title: Draft-PR flow as a project setting
type: feat
status: planned
created: 2026-10-09
tags:
  - desk
  - ci
  - github
  - multi-project
subject: Run & monitor
order: 1
---

The branch-per-idea flow has a GitHub half that paper-camp does not own.
paper-ui and func-ui each carry `.github/workflows/draft-pr.yml`: on the
first push to a `<type>/idea-N-…` branch it opens a draft PR into main,
titled from the idea file and listing its phases from a
`pull_request_template.md`, authenticated as the Scout GitHub App through
two repo secrets. radio had none of it — the first idea run there
(IDEA-8, nine commits) produced a branch and no PR, and the files were
copied over by hand on 2026-10-09. The two copies that existed had already
drifted: func-ui's reads the title from the idea file, paper-ui's still
derives it from the branch slug and points at a `paperplan/plans.md` that
no longer exists.

That is the wrong place for it. The flow is paper-camp's: the desk already
tracks the PR (`pr-map.json`, `pr-lookup.ts`), reads CI runs and the
release PR (`ci-release.ts`), and holds the repo under `desk.ci`. A project
that paper-camp runs should get the workflow the same way it gets the
Claude Code skill and the SessionStart hook — written by paper-camp from a
bundled template, kept current by paper-camp, switched on in Settings next
to *Release Please*. The parts that need the owner's GitHub account — the
Scout app install on the repo and the two secrets — stay manual, but the
desk should say whether they are in place instead of letting the first run
fail at the token step.

**Shape.** `desk.ci.draftPr: boolean` beside `releasePlease`. Switching it
on writes `.github/workflows/draft-pr.yml` and
`.github/pull_request_template.md` from templates bundled with the package
(func-ui's current versions are the source), each stamped with the
template version in a header comment so drift is detectable. `doctor`
reports a missing or outdated copy when the setting is on, and `--fix`
rewrites it through the existing action plan. Desk discovery proposes the
setting as on when the workflow file already exists. The CI card shows the
readiness of the manual half: whether `SCOUT_APP_ID` and
`SCOUT_PRIVATE_KEY` exist on the repo (names only, via
`gh api repos/{repo}/actions/secrets`) and whether the last Draft PR run
succeeded.

### Out of scope

Creating the Scout app or installing it on repositories; both need the
owner's browser. Release Please scaffolding, which is the same idea for
the other workflow and deserves its own entry once this one lands. Any
change to the branch naming or phase-per-commit convention itself.

### Phases
- [x] Phase 1 — The setting
      Add `draftPr?: boolean` to `deskCiSchema` and `DeskCi`, a *Draft PR*
      switch in `desk-ci-editor.tsx` under *Release Please*, and have
      `desk-discovery.ts` propose it on when
      `.github/workflows/draft-pr.yml` exists in the repository.
      run: 5m58s · 76 in · 7.5k out · sonnet-5 · sess:96646d62-a0b2-4ae5-b580-02cbc68ba6a0
- [x] Phase 2 — Bundled templates and the writer
      Vendor func-ui's `draft-pr.yml` and `pull_request_template.md` as
      package templates with a `# paper-camp draft-pr template vN` header;
      add a scaffold function beside `scaffoldClaudeCodeIntegration` that
      writes both when the switch turns on (never overwriting a file that
      lacks the header), and wire it to the settings save.
      run: 5m33s · 60 in · 12.9k out · sonnet-5 · sess:96646d62-a0b2-4ae5-b580-02cbc68ba6a0
- [x] Phase 3 — Doctor check and fix
      A doctor finding when `draftPr` is on and either file is missing or
      carries an older template version; `--fix` rewrites it through the
      existing write action. A finding, not a fix, when the file exists
      without the header, since that is a hand-written workflow.
      run: 8m11s · 116 in · 23.5k out · sonnet-5 · sess:96646d62-a0b2-4ae5-b580-02cbc68ba6a0
- [ ] Phase 4 — Readiness on the CI card
      Show whether the two Scout secrets exist on the repo and the
      conclusion of the latest *Draft PR* workflow run, with the two
      manual steps spelled out when either is missing. Cache like
      `ci-release.ts` does.
- [ ] Phase 5 — Roll out to the three projects
      Turn the setting on in radio, func-ui and paper-ui; let the writer
      replace paper-ui's stale copy and stamp the other two; document the
      setting and the manual half in `about.md`.

### Thread
- [x] 2026-10-09 [decision] [user] The draft-PR flow belongs to every paper-camp project and is configured from Settings, not copied between repositories by hand.
- [ ] 2026-10-09 [question] [agent] Should paper-camp also be able to set the two Scout secrets itself through `gh secret set` when given the private-key path, or is surfacing their presence enough and the secrets stay a dashboard step?
