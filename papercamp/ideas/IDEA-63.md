---
id: IDEA-63
title: Sweep comments to the §7 bar
type: refactor
status: idea
created: 2026-07-15
tags:
  - app
  - core
  - refactor
  - docs
---

[[IDEA-59]] set out to do this and reached `review` without moving the number: `src/` still carries 1431 comment lines, 7.8% of non-test source. The sweep wasn't skipped — it ran against a bar that couldn't reject anything. §7 said a comment "must explain a *why* that isn't derivable from the code", and almost any prose can be argued to clear that, so a pass could delete the obvious restatements, honestly report itself green, and leave every multi-paragraph block standing. Agents kept adding new ones for the same reason.

§7 has since been rewritten with a bar that bites: default zero, and a comment must clear all three of non-derivable *and* costly to rediscover *and* one line (two max), with an explicit ban on narrating decisions or reasoning — that belongs in the commit message. `router.tsx` was cleaned against it as the reference (31 → 9 lines), keeping only `.page`'s `margin: 0 auto` suppressing flex `stretch` and Tailwind's static-literal constraint.

- **Sweep by density, not by folder.** The mass is concentrated: `core/git-pr/pr.ts` (110 lines), `server/agent.ts` (104), `core/git-pr/pr-lookup.ts` (81), `stores/app-store.ts` (64), `core/serialize/serializer.ts` (63), `types/index.ts` (58), `server/git.ts` (55). Those seven are ~37% of the total.
- **Deleting is the default; keep only what would cost real debugging time.** A handful are genuinely load-bearing and must survive: `gh` CLI exit-code semantics, the parser's h3 `### Phases` grammar (a wrong "fix" here silently breaks parsing — see [[IDEA-58]]), StrictMode updater purity, and the `--sketch-clip` geometry. Judge each one; a mechanical strip would take these with it.
- **Docstrings are comments too.** The `/** ... */` blocks on exported functions are the bulk of `pr.ts` and `pr-lookup.ts`, and most paraphrase the signature. Same bar applies.
- **Don't rewrite code to justify a comment.** Where a comment compensates for an unclear name, rename — but that's a rename, not a refactor of behaviour.

Structure-only: no behaviour change, so `tsc`/`biome`/tests/consistency are the gate, plus the comment-line count as the actual measure — report it before/after per file rather than claiming "swept". If the number doesn't move, the pass didn't happen.

### Phases
- [x] Baseline the comment-line count per file
      Record the current per-file counts across `src/` (the seven density files and the total 1431 / 7.8%) so each later phase can report before/after against a fixed starting number rather than a re-measured one.
- [x] Sweep the git-pr docstring pair against §7
      `core/git-pr/pr.ts` (110) and `core/git-pr/pr-lookup.ts` (81) — collapse the `/** ... */` blocks that paraphrase the signature, keeping only the `gh` CLI exit-code semantics. Report before/after per file.
- [x] Sweep the two server files
      `server/agent.ts` (104) and `server/git.ts` (55) against the default-zero bar. Report before/after per file.
- [x] Sweep the store / serialize / types trio
      `stores/app-store.ts` (64), `core/serialize/serializer.ts` (63), `types/index.ts` (58) — but preserve the parser's h3 `### Phases` grammar note (a wrong "fix" silently breaks parsing, see [[IDEA-58]]) and StrictMode updater purity. Report before/after per file.
- [ ] Sweep the remaining long tail across `src/`
      Everything outside the seven density files, same bar. Where a comment only compensates for an unclear name, rename — a rename, not a behaviour refactor. Report before/after per file.
- [ ] Gate and report the net movement
      Run `tsc`/`biome`/tests, confirm the load-bearing survivors remain (`gh` exit-code semantics, the `### Phases` grammar, StrictMode purity, the `--sketch-clip` geometry), and report the total before/after comment-line count. If the number didn't move, the pass didn't happen.
