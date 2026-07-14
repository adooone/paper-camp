---
id: IDEA-59
title: Trim comments to the essential
type: refactor
created: 2026-07-13
tags:
  - app
  - core
  - refactor
  - docs
---

The codebase leans heavily on explanatory comments — many narrate what the code already says or preserve history that git and `papercamp/progress.md` hold better. The preference is the opposite: let names and types carry intent, and keep a comment only when it explains something the code genuinely cannot. Strengthen `docs/CODE_STYLE.md` §7 to say so, then sweep `src/` to match.

- **Codify the rule first.** Rewrite §7 from "prefer self-describing names over comments" to a firmer bar: a comment must earn its place by explaining a *why* that isn't derivable from the code — an environment quirk, a non-obvious protocol shape, a security or correctness rationale, or a paper-ui gap (§1). Restating the next line, narrating history, or labelling an obvious block does not qualify.
- **Keep the load-bearing comments.** Some encode real institutional knowledge and must survive the sweep: the confirmed headless `stream-json` shape (`agents/claude-code.ts`), the git `-- :(literal)` pathspec and rename-source handling (`server/git.ts`), the DNS-rebinding / Host-Origin rationale (`server/api.ts`), the Vite-restart agent-orphan note (`vite.app.config.ts`), and similar. The goal is fewer comments, not a blanket strip.
- **Sweep the rest.** Remove comments that restate code, mark sections a good name would announce, or preserve superseded history. Where a comment was compensating for an unclear name, rename instead of annotate.

Best run right after [[IDEA-58]], so the sweep reviews the already-simplified, de-duplicated code rather than commenting on lines about to move or disappear. Docs-and-comments only — behaviour is unchanged, so `tsc`/`biome`/tests staying green is the whole acceptance check.
