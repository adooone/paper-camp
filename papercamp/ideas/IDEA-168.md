---
id: IDEA-168
title: Version the corpus format
type: feat
status: idea
created: 2026-08-13
updated: 2026-08-13
tags:
  - format
  - core
subject: The format as the product
---

The corpus is a git-stored format read by whatever paper-camp version happens to
be installed — a hub reading many repos ([[IDEA-117]]), a teammate on an older
release, CI, the MCP server. Today nothing declares the format's version, and
nothing survives a round-trip through a version that doesn't know a field.

**The version field already exists and is a lie.** `papercamp/config.json`
carries `version: 0.1.0` while the package is at 0.18.1. Nothing reads it —
`config.version` appears in no source file. It has never been bumped, and no
code would notice if it were.

**Unknown fields are destroyed on write, silently.** Two independent strippers:
the Zod frontmatter schemas are plain `z.object()`, whose default is to drop
unknown keys on parse; and `serializer.ts` rebuilds frontmatter from a fixed
list of known `input.*` properties rather than from what it read. So an older
paper-camp opening an entity written by a newer one loses every field it doesn't
recognise the moment anything writes that file back — and every routine action
writes files back: a status change, a phase toggle, a thread append, an index
regeneration.

This is the real risk behind [[IDEA-117]]'s engineering note. It is not
hypothetical and not multi-project-only: it fires today for anyone running a
different release of paper-camp than the corpus was written with, and it fails
silently — the data is gone before anyone sees an error.

### What this settles

**A real format version, separate from the package version.** The corpus
declares the *format* it was written in, which changes only when the schema
changes, not on every release. `config.version` is repurposed for it — nothing
reads it today, so nothing breaks — and stamped honestly on write.

**Round-trip fidelity is the primary requirement.** Unknown frontmatter keys are
preserved verbatim through read → edit → write. The schemas gain a passthrough
for unrecognised keys, and the serializer emits preserved keys alongside the
ones it knows, in a stable order. A paper-camp that doesn't understand a field
must carry it, not drop it. This is the piece that matters even if nothing else
here ships.

**Tolerant reads, explicit refusal.** A corpus whose format version is *newer*
than the running paper-camp stays readable but is flagged, and writes are
refused rather than performed lossily. The doctor ([[IDEA-121]], done) is where
that surfaces — it already reports corpus-integrity findings and already runs on
every load. An older corpus reads normally.

**Migration is an explicit action, not a startup side effect.** Bumping a corpus
to a newer format is a reviewable step producing a git diff, never an implicit
rewrite on first open.

### Why this stands alone

It is useful single-project: the round-trip fix protects anyone running two
paper-camp versions against one repo, which includes a globally-installed CLI
alongside a repo-pinned dev dependency. It is a hard prerequisite for the
multi-project hub ([[IDEA-117]]), which by definition meets corpora written by
different versions. And it pairs with the doctor, which already exists.

Out of scope: the hub itself, cross-corpus links ([[IDEA-123]]), and any
migration tooling beyond a single doctor-driven bump.
