import { parseEntityFile } from '@/core/parse/parser';
import { formatEntityFile } from '@/core/serialize';
import { PLAN_STATUSES } from '../../types';
import type { EntityStatus, PhaseItem, PhaseRun, ThreadMessage } from '../../types';

const STATUS_RANK = new Map<EntityStatus, number>(
  PLAN_STATUSES.map((status, index) => [status, index + 1]),
);
STATUS_RANK.set('open', 0);

function moreAdvancedStatus(
  a: EntityStatus | undefined,
  b: EntityStatus | undefined,
): EntityStatus | undefined {
  const rankA = a ? (STATUS_RANK.get(a) ?? -1) : -1;
  const rankB = b ? (STATUS_RANK.get(b) ?? -1) : -1;
  return rankA >= rankB ? a : b;
}

function newerUpdated(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A field equal on both sides, or changed on only one side since the merge base, needs
// no judgement to resolve; a real edit on both sides does — null means hand it to the agent.
function mergeScalar<T>(base: T, ours: T, theirs: T): { value: T } | null {
  if (deepEqual(ours, theirs)) return { value: ours };
  if (deepEqual(base, ours)) return { value: theirs };
  if (deepEqual(base, theirs)) return { value: ours };
  return null;
}

// Same accumulation mergeRun (phase-run.ts) uses for a retried phase — a phase that ran
// once on each side before the branches met combines into one totals line, not a pick.
function combineRuns(a: PhaseRun | undefined, b: PhaseRun | undefined): PhaseRun | undefined {
  if (!a) return b;
  if (!b) return a;
  if (deepEqual(a, b)) return a;
  return {
    durationMs: a.durationMs + b.durationMs,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    attempts: a.attempts + b.attempts,
    model: a.model ?? b.model,
    sessionId: b.sessionId ?? a.sessionId,
  };
}

// Phase lists are identical in shape on both sides of a conflict — same file, same
// commit history up to the fork — so index alignment is safe; a length mismatch means
// something unexpected happened upstream and the whole file goes to the agent instead.
function mergePhases(
  base: PhaseItem[],
  ours: PhaseItem[],
  theirs: PhaseItem[],
): PhaseItem[] | null {
  if (base.length !== ours.length || ours.length !== theirs.length) return null;
  const merged: PhaseItem[] = [];
  for (let i = 0; i < ours.length; i++) {
    const text = mergeScalar(base[i].text, ours[i].text, theirs[i].text);
    const description = mergeScalar(
      base[i].description,
      ours[i].description,
      theirs[i].description,
    );
    const source = mergeScalar(base[i].source, ours[i].source, theirs[i].source);
    if (!text || !description || !source) return null;
    merged.push({
      done: ours[i].done || theirs[i].done,
      text: text.value,
      description: description.value,
      source: source.value,
      run: combineRuns(ours[i].run, theirs[i].run),
    });
  }
  return merged;
}

// Union, not a 3-way pick: an entry appended on either side since the fork is kept,
// deduped by exact content, in roughly chronological order (undated entries keep
// their relative position).
function mergeThread(ours: ThreadMessage[] = [], theirs: ThreadMessage[] = []): ThreadMessage[] {
  const merged = [...ours];
  for (const message of theirs) {
    if (!merged.some((existing) => deepEqual(existing, message))) merged.push(message);
  }
  return merged
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      if (a.message.date && b.message.date && a.message.date !== b.message.date) {
        return a.message.date < b.message.date ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ message }) => message);
}

// Resolves a rebase conflict in a papercamp/ idea or plan file by the rules IDEA-319
// settles on: most-advanced status, newest updated, OR'd phase checkboxes with
// accumulated run totals, and a unioned thread. Anything it can't decide by rule —
// two sides editing the same prose or frontmatter field differently — returns null
// so the caller leaves the conflict for the agent instead of guessing.
export function mergePapercampEntity(base: string, ours: string, theirs: string): string | null {
  const baseEntry = parseEntityFile(base).entries[0];
  const oursEntry = parseEntityFile(ours).entries[0];
  const theirsEntry = parseEntityFile(theirs).entries[0];
  if (!baseEntry || !oursEntry || !theirsEntry) return null;
  if (oursEntry.id !== theirsEntry.id) return null;

  const title = mergeScalar(baseEntry.title, oursEntry.title, theirsEntry.title);
  const type = mergeScalar(baseEntry.type, oursEntry.type, theirsEntry.type);
  const kind = mergeScalar(baseEntry.kind, oursEntry.kind, theirsEntry.kind);
  const idea = mergeScalar(baseEntry.idea, oursEntry.idea, theirsEntry.idea);
  const agent = mergeScalar(baseEntry.agent, oursEntry.agent, theirsEntry.agent);
  const created = mergeScalar(baseEntry.created, oursEntry.created, theirsEntry.created);
  const audited = mergeScalar(baseEntry.audited, oursEntry.audited, theirsEntry.audited);
  const auditedHash = mergeScalar(
    baseEntry.auditedHash,
    oursEntry.auditedHash,
    theirsEntry.auditedHash,
  );
  const released = mergeScalar(baseEntry.released, oursEntry.released, theirsEntry.released);
  const tags = mergeScalar(baseEntry.tags, oursEntry.tags, theirsEntry.tags);
  const needs = mergeScalar(baseEntry.needs, oursEntry.needs, theirsEntry.needs);
  const subject = mergeScalar(baseEntry.subject, oursEntry.subject, theirsEntry.subject);
  const order = mergeScalar(baseEntry.order, oursEntry.order, theirsEntry.order);
  const issueSource = mergeScalar(
    baseEntry.issueSource,
    oursEntry.issueSource,
    theirsEntry.issueSource,
  );
  const body = mergeScalar(baseEntry.body, oursEntry.body, theirsEntry.body);
  const fixes = mergeScalar(baseEntry.fixes, oursEntry.fixes, theirsEntry.fixes);
  const unknownFrontmatter = mergeScalar(
    baseEntry.unknownFrontmatter,
    oursEntry.unknownFrontmatter,
    theirsEntry.unknownFrontmatter,
  );
  const phases = mergePhases(baseEntry.phases, oursEntry.phases, theirsEntry.phases);

  if (
    !title ||
    !type ||
    !kind ||
    !idea ||
    !agent ||
    !created ||
    !audited ||
    !auditedHash ||
    !released ||
    !tags ||
    !needs ||
    !subject ||
    !order ||
    !issueSource ||
    !body ||
    !fixes ||
    !unknownFrontmatter ||
    !phases
  ) {
    return null;
  }

  const merged: Parameters<typeof formatEntityFile>[0] = {
    id: oursEntry.id,
    title: title.value,
    type: type.value,
    kind: kind.value,
    status: moreAdvancedStatus(oursEntry.status, theirsEntry.status),
    idea: idea.value,
    agent: agent.value,
    created: created.value,
    updated: newerUpdated(oursEntry.updated, theirsEntry.updated),
    audited: audited.value,
    auditedHash: auditedHash.value,
    released: released.value,
    tags: tags.value,
    needs: needs.value,
    subject: subject.value,
    order: order.value,
    issueSource: issueSource.value,
    body: body.value,
    phases,
    fixes: fixes.value,
    thread: mergeThread(oursEntry.thread, theirsEntry.thread),
    unknownFrontmatter: unknownFrontmatter.value,
  };

  return `${formatEntityFile(merged).trim()}\n`;
}
