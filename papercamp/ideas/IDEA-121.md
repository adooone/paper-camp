---
id: IDEA-121
title: paper-camp doctor — corpus lint and format migrations
type: feat
status: idea
created: 2026-08-04
tags:
  - format
  - cli
---

A `paper-camp doctor` command that validates corpus structure: frontmatter schema, id/counter consistency with config, phases-list integrity, archive placement matching status, dangling `[[links]]`.

Motivated by a real corruption: in the func-ui corpus, an agent inserting a Log section mid-file accidentally split a Phases list, orphaning two phases inside the Log — the idea silently parsed as one checked phase and displayed as complete. A linter catches that class of damage instantly; hand-editing agents guarantee it will keep happening ([[IDEA-122]] is the prevention side, this is the detection side).

Doctor is also the natural home for format migrations when the schema evolves — which Horizon 4's **format as the product** requires anyway: a documented schema needs a validator, and a validator is 80% of a migrator.
