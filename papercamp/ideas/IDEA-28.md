---
id: IDEA-28
title: Idea-file heading level (MD001)
---

## IDEA-28: Idea-file heading level (MD001)

Every idea file opens its body with a level-3 heading — `### IDEA-N: Title` — immediately after the YAML frontmatter. markdownlint's MD001 (heading-increment) flags this because the first heading jumps straight to `###` without an `h1`/`h2` above it. CodeRabbit raises it on every new idea file (IDEA-25, IDEA-26, …).

It's **not a CI gate** today (no markdownlint in the workflows), only CodeRabbit's own doc-lint — which is why it keeps recurring as a per-file nitpick that's wrong to fix in isolation: demoting a single file to `##` would make it the one inconsistent idea file among ~26.

**The proper fix is repo-wide, so it's its own chore (not part of any feature PR):**
- Change the body heading in every `papercamp/ideas/IDEA-*.md` from `### IDEA-N:` to `## IDEA-N:`.
- Update the references to the heading level so new ideas comply: `buildIdeaExtendPrompt` in `src/app/features/plans/prompts.ts` ("Do not change the `### IDEA-N:` heading line") and the format comment in `src/core/parser.ts` (~line 401).
- Check idea-creation (`formatIdeaFile` / the Add-idea flow) doesn't hardcode `###`.

**Worth deciding first:** the body heading may be redundant entirely — the frontmatter already carries `id` and `title`, so `## IDEA-N: Title` just duplicates them. Options are (a) demote `###` → `##`, or (b) drop the body heading line altogether and let the frontmatter be the single source of the title. Pick one during the fix rather than defaulting to the mechanical demotion. Related: [[IDEA-25]], [[IDEA-26]].
