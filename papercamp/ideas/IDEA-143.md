---
id: IDEA-143
title: One title style for all ideas
type: chore
status: idea
created: 2026-08-07
tags:
  - format
  - docs
  - git
subject: The format as the product
---

Idea titles have drifted into symptom sentences ("Desk is broken under
the mount — router basepath, API base, and a friendlier route" → a
90-character branch name). AGENTS.md's branch scheme already assumes "the
entity's short title", but no written rule exists, so every author —
human, desk capture, suggest-ideas, conversation captures — invents their
own length. One convention, enforced where titles are born:

1. **The rule.** A title is a noun/verb phrase, at most 40 characters,
   roughly 3–6 words. No em-dash subtitles, no trailing clause — the
   symptom, mechanism, and detail belong in the body's first paragraph.
   One style for every type; a fix is not licensed to be a sentence.
   ("Desk is broken under the mount — router basepath, API base, and a
   friendlier route" → "Desk breaks under the mount".)

2. **Written where authors read.** The rule lands in AGENTS.md (beside
   the branch scheme it protects) and papercamp/about.md, and the New
   idea capture, suggest-ideas, and draft prompts state it in one line.

3. **Branch slugs cap regardless.** `branchName()` truncates the kebab
   slug at 40 characters on a word boundary, so legacy long titles stop
   producing huge branches without any renames.

4. **Doctor lints it.** [[IDEA-121]]'s corpus lint gains a title check —
   flagging active ideas only. Done and archived ideas keep their titles:
   routes and history reference titles, and renaming closed work is churn
   with no payoff.

### Thread
- [x] 2026-08-07 [decision] Convention: noun/verb phrase, ≤40 chars, no em-dash subtitles, detail in the body — applied to new and active ideas only; legacy titles are handled by the branch-slug cap, not renames.
