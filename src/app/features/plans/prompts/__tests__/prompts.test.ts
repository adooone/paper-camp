import { buildAgentPrompt } from '@/app/server/agent';
import type { EntityEntry, IdeaEntry, PlanEntry, ReviewThread, ThreadMessage } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  buildConvergenceAuditPrompt,
  buildFeedbackReplyPrompt,
  buildFeedbackSummaryPrompt,
  buildFixReviewPrompt,
  buildIdeaExtendPrompt,
  buildOverlapCheckPrompt,
  buildPlanDraftPrompt,
  buildReconcilePrompt,
} from '../prompts';

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

  // The fix-review launch path runs on the plan's already-open PR branch, but
  // deliberately does NOT commit: a human reviews and commits the work, using
  // the message the agent proposes (it knows the intent behind each fix).
  it('fix-review prompt renders each unresolved thread and leaves the work uncommitted', () => {
    const threads: ReviewThread[] = [
      {
        id: 'PRRT_1',
        path: 'src/core/pr.ts',
        line: 42,
        author: 'coderabbitai',
        body: 'This can throw on empty input.',
      },
      { id: 'PRRT_2', body: 'General comment with no diff anchor.' },
    ];
    const prompt = buildFixReviewPrompt(plan, threads);
    expect(prompt).toContain(`papercamp/ideas/${plan.id}.md`);
    expect(prompt).toContain('src/core/pr.ts:42');
    expect(prompt).toContain('(coderabbitai)');
    expect(prompt).toContain('This can throw on empty input.');
    expect(prompt).toContain('(general PR comment)');
    expect(prompt).toContain('General comment with no diff anchor.');
    // The human commits, so the agent must not: it only proposes the message.
    expect(prompt).toContain('Do NOT commit, push, stage, or create a branch');
    expect(prompt).not.toContain('git commit --no-verify');
    expect(prompt).toContain('type(scope): Description');
    expect(prompt).toContain('Refs: IDEA-9');
    // Every comment must be accounted for as addressed or skipped — that split
    // drives which PR threads get resolved (on push) vs replied to.
    expect(prompt).toContain('"addressed"');
    expect(prompt).toContain('"skipped"');
    expect(prompt).toContain('from 1 to 2');
    // Must evaluate comments, not blindly obey — a wrong suggestion (e.g. the
    // papercamp heading demotion) shouldn't be applied.
    expect(prompt).toContain('NOT a command to obey');
    expect(prompt).toContain('Never check, uncheck, add, or remove any phase');
  });

  it('fix-review prompt guards against an empty thread list by making no changes', () => {
    const prompt = buildFixReviewPrompt(plan, []);
    expect(prompt).toContain('no unresolved review threads were found');
    expect(prompt).toContain('do not edit, commit, or push anything');
    expect(prompt).not.toContain('"addressed"');
  });
});

describe('buildFeedbackReplyPrompt', () => {
  it('carries the Paper Scout persona and defaults scope to the bound idea', () => {
    const prompt = buildFeedbackReplyPrompt(plan, []);
    expect(prompt).toContain('You are Paper Scout');
    expect(prompt).toContain("that's your default scope");
    expect(prompt).toContain('(no other ideas exist in this project yet)');
  });

  it('lists every other idea for answering questions outside the bound one', () => {
    const otherEntities: EntityEntry[] = [
      {
        id: 'IDEA-3',
        title: 'Another idea',
        status: 'planned',
        created: '2026-06-01',
        tags: [],
        body: 'Another idea body.',
        phases: [],
      },
    ];
    const prompt = buildFeedbackReplyPrompt(plan, otherEntities);
    expect(prompt).toContain('### IDEA-3: Another idea (status: planned)');
    expect(prompt).toContain('Another idea body.');
    expect(prompt).toContain('never propose an "edit" for it');
  });

  it('collapses done and dropped ideas to one-line index entries', () => {
    const otherEntities: EntityEntry[] = [
      {
        id: 'IDEA-4',
        title: 'Finished idea',
        status: 'done',
        created: '2026-06-01',
        tags: [],
        body: 'Finished idea body.',
        phases: [],
      },
      {
        id: 'IDEA-5',
        title: 'Dropped idea',
        status: 'dropped',
        created: '2026-06-01',
        tags: [],
        body: 'Dropped idea body.',
        phases: [],
      },
    ];
    const prompt = buildFeedbackReplyPrompt(plan, otherEntities);
    expect(prompt).toContain('- IDEA-4: Finished idea (status: done)');
    expect(prompt).toContain('- IDEA-5: Dropped idea (status: dropped)');
    expect(prompt).not.toContain('Finished idea body.');
    expect(prompt).not.toContain('Dropped idea body.');
  });

  it('omits the ambient context block when no mount context is given', () => {
    const prompt = buildFeedbackReplyPrompt(plan, []);
    expect(prompt).not.toContain('Ambient context');
  });

  it('folds whatever a mount fed into a silent ambient context block', () => {
    const prompt = buildFeedbackReplyPrompt(plan, [], {
      route: '/checkout',
      focusedIdeaId: 'IDEA-9',
      viewport: { width: 375, height: 812 },
    });
    expect(prompt).toContain('never mention it explicitly');
    expect(prompt).toContain('Current route in the host app: /checkout');
    expect(prompt).toContain('Idea focused in the mount: IDEA-9');
    expect(prompt).toContain('Viewport: 375×812');
  });

  it('orders sections stable-first: persona, corpus index, idea, then thread', () => {
    const otherEntities: EntityEntry[] = [
      {
        id: 'IDEA-3',
        title: 'Another idea',
        status: 'planned',
        created: '2026-06-01',
        tags: [],
        body: 'Another idea body.',
        phases: [],
      },
    ];
    const withThread: PlanEntry = {
      ...plan,
      thread: [{ kind: 'chat', text: 'Latest message', from: 'user' }],
    };
    const prompt = buildFeedbackReplyPrompt(withThread, otherEntities);
    const personaIndex = prompt.indexOf('You are Paper Scout');
    const corpusIndex = prompt.indexOf('### IDEA-3: Another idea');
    const ideaIndex = prompt.indexOf('Idea/plan body:');
    const threadIndex = prompt.indexOf('Feedback thread, most recent messages:');
    expect(personaIndex).toBeGreaterThanOrEqual(0);
    expect(personaIndex).toBeLessThan(corpusIndex);
    expect(corpusIndex).toBeLessThan(ideaIndex);
    expect(ideaIndex).toBeLessThan(threadIndex);
  });

  it('renders prior log-kind entries as session summaries, not raw thread lines', () => {
    const withThread: PlanEntry = {
      ...plan,
      thread: [{ kind: 'log', date: '2026-07-01', text: 'Settled on approach A.' }],
    };
    const prompt = buildFeedbackReplyPrompt(withThread, []);
    expect(prompt).toContain('Prior session summaries, oldest first:');
    expect(prompt).toContain('- Settled on approach A.');
  });

  it('caps the inlined thread to the last 10 non-summary messages', () => {
    const messages: ThreadMessage[] = Array.from({ length: 12 }, (_, i) => ({
      kind: 'chat',
      text: `Message ${i + 1}`,
      from: i % 2 === 0 ? 'user' : 'agent',
    }));
    const withThread: PlanEntry = { ...plan, thread: messages };
    const prompt = buildFeedbackReplyPrompt(withThread, []);
    expect(prompt).not.toContain('Message 1\n');
    expect(prompt).not.toContain('Message 2\n');
    expect(prompt).toContain('Message 3');
    expect(prompt).toContain('Message 12');
  });
});

describe('buildFeedbackSummaryPrompt', () => {
  it('lays out the exchange oldest-first with the Paper Scout persona', () => {
    const prompt = buildFeedbackSummaryPrompt(plan, [
      { kind: 'chat', text: 'What should we do about X?', from: 'user' },
      { kind: 'chat', text: "Let's go with Y.", from: 'agent' },
    ]);
    expect(prompt).toContain('You are Paper Scout');
    expect(prompt).toContain("User: What should we do about X?\nAgent: Let's go with Y.");
    expect(prompt).toContain('{"summary": "one sentence"}');
  });
});
