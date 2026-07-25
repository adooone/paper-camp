import { join } from 'node:path';
import { resolvePrimaryScope } from '@/core/git-pr';
import { parseEntityFile } from '@/core/parse';
import { computePlanContentHash } from '@/core/serialize';
import { prependProgressItem as prependProgressLine, todayDateString } from '@/core/serialize';
import type { PhaseItem, PlanEntry } from '@/types/index';
import type { GitManager } from './git';
import { campFile, entityFileInput, fileExists, readMaybe, writeEntityFile } from './helpers';

function resolveCommitScope(plan: Pick<PlanEntry, 'tags'>): string {
  return resolvePrimaryScope(plan.tags, 'plans');
}

// Kept out of api.ts so the middleware only wires managers together.
export function createAgentHooks(root: string, git: GitManager) {
  async function prependProgressItem(item: string): Promise<void> {
    await prependProgressLine(campFile(root, 'progress.md'), item);
  }

  async function stampAuditDate(planId: string, gapPhases: number): Promise<void> {
    const ideasDir = campFile(root, 'ideas');
    // Batch audit can touch archived (done/dropped) entities too — resolve the
    // actual file so those get stamped instead of re-audited every run.
    const directFile = join(ideasDir, `${planId}.md`);
    const archivedFile = join(ideasDir, 'archive', `${planId}.md`);
    const planFile = (await fileExists(directFile))
      ? directFile
      : (await fileExists(archivedFile))
        ? archivedFile
        : null;
    if (!planFile) return;
    const raw = await readMaybe(planFile);
    if (!raw) return;
    const parsed = parseEntityFile(raw);
    if (parsed.entries.length === 0) return;
    const entry = parsed.entries[0];
    const auditedHash = computePlanContentHash({ body: entry.body, phases: entry.phases });
    await writeEntityFile(
      planFile,
      entityFileInput(entry, { audited: todayDateString(), auditedHash }),
    );
    if (gapPhases > 0) {
      const label = `gap phase${gapPhases === 1 ? '' : 's'}`;
      await prependProgressItem(
        `Batch audit of ${planId} (${entry.title}) — ${gapPhases} ${label} appended`,
      );
    }
  }

  async function commitPhase(plan: PlanEntry, phase: PhaseItem): Promise<void> {
    const area = resolveCommitScope(plan);
    const title = `${plan.kind ?? 'feat'}(${area}): ${phase.text}`;
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.stageAll();
    // noVerify: this is a machine-generated commit; the message is valid by
    // construction, so the commit-msg hook must not block an unattended run.
    await git.commit([], title, refs, { noVerify: true });
  }

  async function setRunReview(plan: PlanEntry): Promise<void> {
    if (!plan.id) return;
    const ideasDir = campFile(root, 'ideas');
    const planFile = join(ideasDir, `${plan.id}.md`);
    const raw = await readMaybe(planFile);
    if (!raw) return;
    const parsed = parseEntityFile(raw);
    if (parsed.entries.length === 0) return;
    const entry = parsed.entries[0];
    if (entry.status === 'review' || entry.status === 'done' || entry.status === 'dropped') return;
    await writeEntityFile(
      planFile,
      entityFileInput(entry, {
        status: 'review',
        updated: todayDateString(),
      }),
    );
    const area = resolveCommitScope(plan);
    const refs = plan.id ? `Refs: ${plan.id}` : undefined;
    await git.stageAll();
    await git.commit([], `${entry.type ?? 'feat'}(${area}): mark ${plan.id} review`, refs, {
      noVerify: true,
    });
  }

  return { stampAuditDate, commitPhase, setRunReview };
}
