import { buildAgentPrompt } from '@/app/server/agent';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  buildClarifyPrompt,
  buildConvergenceAuditPrompt,
  buildIdeaExtendPrompt,
  buildPlanDraftPrompt,
  buildReconcilePrompt,
} from './prompts';

const idea: IdeaEntry = { id: 'IDEA-7', title: 'Test idea', body: 'Idea body prose.' };

const plan: PlanEntry = {
  title: 'Test plan',
  status: 'in-progress',
  kind: 'feat',
  id: 'FEAT-9',
  idea: 'IDEA-7',
  created: '2026-06-30',
  tags: ['app'],
  body: 'Plan body prose.',
  phases: [{ done: false, text: 'Do the thing' }],
  log: [],
  clarifications: [],
};

// Guards the FEAT-24 per-file migration: the agent prompts must point at
// papercamp/plans/<ID>.md and papercamp/ideas/<ID>.md, never the legacy
// monolithic files. A draft agent that writes to plans.md is exactly the
// regression this suite exists to catch.
describe('agent prompts target per-file storage', () => {
  it('plan-draft prompt writes a per-file plan in YAML-frontmatter shape', () => {
    const prompt = buildPlanDraftPrompt(idea, []);
    expect(prompt).toContain('papercamp/plans/<KIND>-<N>.md');
    // YAML frontmatter shape, not the old "## Heading" + "**Field:**" form
    expect(prompt).toContain('status: idea');
    expect(prompt).toContain(`idea: ${idea.id}`);
    expect(prompt).not.toContain('**Status:**');
    // The only mention of plans.md must be the explicit "don't use it" guard,
    // never an instruction to write a "plans.md entry" or order it by file position.
    expect(prompt).not.toContain('new plans.md entry');
    expect(prompt).not.toContain('file order in papercamp/plans.md');
  });

  it('idea-extend prompt points at the per-file idea, not legacy ideas.md', () => {
    const prompt = buildIdeaExtendPrompt(idea);
    expect(prompt).toContain(`papercamp/ideas/${idea.id}.md`);
    expect(prompt).not.toContain('ideas.md');
  });

  it('convergence-audit prompt points at the per-file plan, not legacy plans.md', () => {
    const prompt = buildConvergenceAuditPrompt(plan);
    expect(prompt).toContain(`papercamp/plans/${plan.id}.md`);
    expect(prompt).toContain(`papercamp/plans/archive/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
  });

  it('clarify prompt points at the per-file plan, not legacy plans.md', () => {
    const prompt = buildClarifyPrompt(plan);
    expect(prompt).toContain(`papercamp/plans/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
  });

  it('reconcile prompt targets the per-file plan and keeps its guardrails', () => {
    const prompt = buildReconcilePrompt(plan);
    expect(prompt).toContain(`papercamp/plans/${plan.id}.md`);
    expect(prompt).toContain(`papercamp/plans/archive/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
    // The guardrails are the whole point of the reconcile pass — an AI rewrite
    // that edits frontmatter or the phase set would corrupt the plan. Regressions
    // in this prose must fail the build, not ship silently.
    expect(prompt).toContain('Never touch the YAML frontmatter');
    expect(prompt).toContain('Never add or remove phases');
    expect(prompt).toMatch(/Never un-check.*phase line/);
  });

  it('phase-execution prompt points at the per-file plan, not legacy plans.md', () => {
    const prompt = buildAgentPrompt(plan, plan.phases[0], 0);
    expect(prompt).toContain(`papercamp/plans/${plan.id}.md`);
    expect(prompt).not.toContain('plans.md');
    // progress.md is still the live append-only log — that reference must stay
    expect(prompt).toContain('progress.md');
  });
});
