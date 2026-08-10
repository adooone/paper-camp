---
id: IDEA-121
title: paper-camp doctor
type: feat
status: idea
created: 2026-08-04
tags:
  - format
  - cli
subject: The format as the product
---

A `paper-camp doctor` command that validates corpus structure: frontmatter schema, id/counter consistency with config, phases-list integrity, archive placement matching status, dangling `[[links]]`.

Motivated by a real corruption: in the func-ui corpus, an agent inserting a Log section mid-file accidentally split a Phases list, orphaning two phases inside the Log — the idea silently parsed as one checked phase and displayed as complete. A linter catches that class of damage instantly; hand-editing agents guarantee it will keep happening ([[IDEA-122]] is the prevention side, this is the detection side).

Doctor is also the natural home for format migrations when the schema evolves — which Horizon 4's **format as the product** requires anyway: a documented schema needs a validator, and a validator is 80% of a migrator.

### Phases
- [x] Codify the corpus schema and rule set
      Enumerate each check (frontmatter fields, id/counter, phases-list integrity, archive placement, dangling links) with a severity.
      run: 2m20s · 5.4k in · 7.9k out · opus-4-8
- [ ] Scaffold the `paper-camp doctor` command and reporter
      One reporter emitting file, line, rule, and severity so findings are addressable.
- [ ] Implement the metadata checks
      Frontmatter schema validation and id/counter consistency against config.
- [ ] Implement the structural checks
      Parse the body for split/orphaned phases lists, archive placement matching status, and dangling `[[links]]`.
- [ ] Surface doctor findings in the app's checks panel
- [ ] Add a migration path for schema evolution
      Reuse the validator as the basis for `--fix` / migrate when the format changes.
