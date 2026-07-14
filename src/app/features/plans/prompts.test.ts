import { buildAgentPrompt } from '@/app/server/agent';
import type { IdeaEntry, PlanEntry, ReviewThread } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  buildConvergenceAuditPrompt,
  buildFixReviewPrompt,
  buildIdeaExtendPrompt,
  buildOverlapCheckPrompt,
  buildPlanDraftPrompt,
  buildReconcilePrompt,
} from './prompts';

const idea: IdeaEntry = { id: 'IDEA-7', title: 'Test idea', body: 'Idea body prose.' };

const plan: PlanEntry = {
  title: 'Test plan',
  status: 'in-progress',
  kind: 'feat',
  id: 'IDEA-9',
  created: '2026-06-30',
  tags: ['app'],
  body: 'Plan body prose.',
  phases: [{ done: false, text: 'Do the thing' }],
  log: [],
  clarifications: [],
};

// The agent prompts must point at papercamp/ideas/<ID>.md (one file per
// entity), never the retired papercamp/plans/ tree or the legacy monolithic
// files. A draft agent that creates a new plan file is exactly the regression
// this suite exists to catch.
describe('agent prompts target the unified entity corpus', () => {
  it('plan-draft prompt edits the idea file in place, adding Phases and type', () => {
    const prompt = buildPlanDraftPrompt(idea, []);
    expect(prompt).toContain(`papercamp/ideas/${idea.id}.md`);
    expect(prompt).toContain('never create a new file');
    expect(prompt).toContain('### Phases');
    // Status stays idea for the human promotion gate; the id never changes.
    expect(prompt).toMatch(/`status` stays exactly `idea`/);
    expect(prompt).not.toContain('papercamp/plans/');
    expect(prompt).not.toContain('**Status:**');
  });

  it('idea-extend prompt points at the per-file idea, not legacy ideas.md', () => {
    const prompt = buildIdeaExtendPrompt(idea);
    expect(prompt).toContain(`papercamp/ideas/${idea.id}.md`);
    expect(prompt).not.toContain('ideas.md');
  });

  it('idea-extend prompt appends a dated Log entry instead of rewriting the body', () => {
    const prompt = buildIdeaExtendPrompt(idea);
    expect(prompt).toContain('### Log');
    expect(prompt).toContain('YYYY-MM-DD');
    expect(prompt).toContain('Append only');
    expect(prompt).not.toContain('Replace everything below that heading');
  });

  it('convergence-audit prompt points at the entity file, not legacy plans.md', () => {
    const prompt = buildConvergenceAuditPrompt(plan);
    expect(prompt).toContain(`papercamp/ideas/${plan.id}.md`);
    expect(prompt).toContain(`papercamp/ideas/archive/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
  });

  it('reconcile prompt targets the entity file and keeps its guardrails', () => {
    const prompt = buildReconcilePrompt(plan);
    expect(prompt).toContain(`papercamp/ideas/${plan.id}.md`);
    expect(prompt).toContain(`papercamp/ideas/archive/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
    // The guardrails are the whole point of the reconcile pass — an AI rewrite
    // that edits frontmatter or the phase set would corrupt the plan. Regressions
    // in this prose must fail the build, not ship silently.
    expect(prompt).toContain('Never touch the YAML frontmatter');
    expect(prompt).toContain('Never add or remove phases');
    expect(prompt).toMatch(/Never un-check.*phase line/);
  });

  it('reconcile prompt handles phase-less backlog ideas without a phases section', () => {
    const backlogIdea: PlanEntry = { ...plan, phases: [] };
    const prompt = buildReconcilePrompt(backlogIdea);
    expect(prompt).toContain(`papercamp/ideas/${backlogIdea.id}.md`);
    expect(prompt).toContain('(none — this is a backlog idea with no phases yet)');
    // Same guardrails still apply — a phase-less idea must not gain phases via reconcile.
    expect(prompt).toContain('Never touch the YAML frontmatter');
    expect(prompt).toContain('Never add or remove phases');
  });

  it('phase-execution prompt points at the entity file, not legacy plans.md', () => {
    const prompt = buildAgentPrompt(plan, plan.phases[0], 0);
    expect(prompt).toContain(`papercamp/ideas/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
    // progress.md is still the live append-only log — that reference must stay
    expect(prompt).toContain('progress.md');
  });

  // The "Check overlap" action is read-only — it never edits a file, so its
  // guardrails are the opposite of every other prompt above: no tools, no file access.
  it('overlap-check prompt is read-only and asks for a mechanically-parseable verdict', () => {
    const prompt = buildOverlapCheckPrompt('A new intention', [
      { id: 'IDEA-7', title: 'Test idea', body: 'Idea body prose.', tags: ['app'] },
    ]);
    expect(prompt).toContain('Do not use any tools, do not read or edit any files');
    expect(prompt).toContain('### IDEA-7: Test idea (tags: app)');
    expect(prompt).toContain('"verdict": "existing" | "extend" | "new"');
    expect(prompt).not.toContain('papercamp/ideas/');
  });

  it('overlap-check prompt handles an empty ideas index', () => {
    const prompt = buildOverlapCheckPrompt('A new intention', []);
    expect(prompt).toContain('(no existing ideas yet)');
  });

  // The fix-review launch path runs on the plan's already-open PR branch and
  // must push, unlike every prompt above.
  it('fix-review prompt renders each unresolved thread with its location and pushes the fix', () => {
    const threads: ReviewThread[] = [
      {
        path: 'src/core/pr.ts',
        line: 42,
        author: 'coderabbitai',
        body: 'This can throw on empty input.',
      },
      { body: 'General comment with no diff anchor.' },
    ];
    const prompt = buildFixReviewPrompt(plan, threads);
    expect(prompt).toContain(`papercamp/ideas/${plan.id}.md`);
    expect(prompt).toContain('src/core/pr.ts:42');
    expect(prompt).toContain('(coderabbitai)');
    expect(prompt).toContain('This can throw on empty input.');
    expect(prompt).toContain('(general PR comment)');
    expect(prompt).toContain('General comment with no diff anchor.');
    expect(prompt).toContain('Commit your changes and push');
    // The commit must land with a convention-following message so no manual
    // suggest step is needed after the fix — type(scope) title + Refs footer.
    expect(prompt).toContain('type(scope): Description');
    expect(prompt).toContain('Refs: IDEA-9');
    // Must commit with --no-verify or the commit-msg lint hook rejects the
    // machine commit and leaves the work uncommitted (the reported bug).
    expect(prompt).toContain('git commit --no-verify');
    // Must evaluate comments, not blindly obey — a wrong suggestion (e.g. the
    // papercamp heading demotion) shouldn't be applied.
    expect(prompt).toContain('NOT a command to obey');
    expect(prompt).toContain('Never check, uncheck, add, or remove any phase');
  });

  it('fix-review prompt guards against an empty thread list by making no changes', () => {
    const prompt = buildFixReviewPrompt(plan, []);
    expect(prompt).toContain('no unresolved review threads were found');
    expect(prompt).toContain('do not edit, commit, or push anything');
    expect(prompt).not.toContain('Commit your changes and push');
  });
});
