import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePlanFile } from '../../core/parser';
import { todayDateString } from '../../core/serializer';
import type { PhaseItem, PlanEntry } from '../../types/index';
import type { GitManager } from './git';
import { campFile, fileExists, planFileInput, readMaybe, writePlanFile } from './helpers';

/**
 * Callbacks the agent manager invokes as tasks progress: stamping audit dates,
 * committing per-phase work, and handing a finished run over to review. Kept out of
 * api.ts so the middleware only wires managers together.
 */
export function createAgentHooks(root: string, git: GitManager) {
  async function prependProgressItem(item: string): Promise<void> {
    const progressPath = campFile(root, 'progress.md');
    const today = todayDateString();
    const heading = `## ${today}`;
    const raw = await readMaybe(progressPath);
    if (raw.startsWith(`${heading}\n`)) {
      await writeFile(
        progressPath,
        `${heading}\n- ${item}\n${raw.slice(heading.length + 1)}`,
        'utf-8',
      );
    } else {
      const trimmed = raw.trimEnd();
      const next = trimmed ? `${heading}\n- ${item}\n\n${trimmed}\n` : `${heading}\n- ${item}\n`;
      await writeFile(progressPath, next, 'utf-8');
    }
  }

  async function stampAuditDate(planId: string, gapPhases: number): Promise<void> {
    const plansDir = campFile(root, 'plans');
    // Batch audit can touch archived (done/dropped) plans too — resolve the
    // actual file so those get stamped instead of re-audited every run.
    const directPlanFile = join(plansDir, `${planId}.md`);
    const archivedPlanFile = join(plansDir, 'archive', `${planId}.md`);
    const planFile = (await fileExists(directPlanFile))
      ? directPlanFile
      : (await fileExists(archivedPlanFile))
        ? archivedPlanFile
        : null;
    if (!planFile) return;
    const raw = await readMaybe(planFile);
    if (!raw) return;
    const parsed = parsePlanFile(raw);
    if (parsed.entries.length === 0) return;
    const entry = parsed.entries[0];
    await writePlanFile(planFile, planFileInput(entry, { id: planId, audited: todayDateString() }));
    if (gapPhases > 0) {
      const label = `gap phase${gapPhases === 1 ? '' : 's'}`;
      await prependProgressItem(
        `Batch audit of ${planId} (${entry.title}) — ${gapPhases} ${label} appended`,
      );
    }
  }

  async function commitPhase(plan: PlanEntry, phase: PhaseItem): Promise<void> {
    const area = plan.tags?.[0] ?? 'plans';
    const title = `${plan.kind ?? 'feat'}(${area}): ${phase.text}`;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.stageAll();
    await git.commit([], title, refs);
  }

  async function setRunReview(plan: PlanEntry): Promise<void> {
    if (!plan.id) return;
    const plansDir = campFile(root, 'plans');
    const planFile = join(plansDir, `${plan.id}.md`);
    const raw = await readMaybe(planFile);
    if (!raw) return;
    const parsed = parsePlanFile(raw);
    if (parsed.entries.length === 0) return;
    const entry = parsed.entries[0];
    if (entry.status === 'review' || entry.status === 'done' || entry.status === 'dropped') return;
    await writePlanFile(
      planFile,
      planFileInput(entry, {
        id: entry.id ?? plan.id,
        status: 'review',
        updated: todayDateString(),
      }),
    );
    const area = plan.tags?.[0] ?? 'plans';
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.stageAll();
    await git.commit([], `${entry.kind ?? 'feat'}(${area}): mark ${plan.id} review`, refs);
  }

  return { stampAuditDate, commitPhase, setRunReview };
}
