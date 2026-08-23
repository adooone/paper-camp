import { buildFeedbackReplyPrompt, buildFeedbackSummaryPrompt } from '@/app/features/plans/prompts';
import { isClosedEntity } from '@/core/status';
import type {
  EntityEntry,
  EntityStatus,
  FeedbackEdit,
  FeedbackPhaseEdit,
  FeedbackReplyResult,
  MountContext,
  PhaseItem,
  PlanEntry,
  ThreadMessage,
} from '@/types/index';

function toPhaseEdit(raw: {
  op?: string;
  index?: number;
  text?: string;
  description?: string;
}): FeedbackPhaseEdit | undefined {
  if (!raw.text?.trim()) return undefined;
  if (raw.op === 'add') {
    return { op: 'add', text: raw.text.trim(), description: raw.description?.trim() || undefined };
  }
  if (raw.op === 'reword' && typeof raw.index === 'number') {
    return {
      op: 'reword',
      index: raw.index,
      text: raw.text.trim(),
      description: raw.description?.trim() || undefined,
    };
  }
  return undefined;
}

function toEdit(raw: {
  phases?: { op?: string; index?: number; text?: string; description?: string }[];
  body?: string;
}): FeedbackEdit | undefined {
  const phases = (raw.phases ?? []).map(toPhaseEdit).filter((p): p is FeedbackPhaseEdit => !!p);
  const body = raw.body?.trim() || undefined;
  if (phases.length === 0 && !body) return undefined;
  return { ...(phases.length ? { phases } : {}), ...(body ? { body } : {}) };
}

// Claude's `-p --output-format json` wraps the model's text in {result: "..."}; opencode's
// `--format json` doesn't. Unwrap either shape, then pull the trailing JSON object.
function extractJsonBlock(output: string): string | null {
  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}
  return resultText.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

/** One-shot, read-only agent call, independent of the long-running phase/task system in
 * agent.ts — never blocked by, and never blocks, a running phase/reconcile/etc. Never
 * edits a file itself; the caller applies the returned edit via applyFeedbackEdit below.
 * A request always becomes an edit on the current plan, never a new idea. */
export async function replyToFeedback(
  plan: PlanEntry,
  otherEntities: EntityEntry[],
  runPrompt: (prompt: string, planTitle: string) => Promise<string>,
  context?: MountContext,
): Promise<FeedbackReplyResult> {
  const prompt = buildFeedbackReplyPrompt(plan, otherEntities, context);
  const output = await runPrompt(prompt, plan.title);

  const jsonBlock = extractJsonBlock(output);
  if (!jsonBlock) throw new Error('Agent did not return a reply');

  const data = JSON.parse(jsonBlock) as {
    reply?: string;
    answersQuestion?: boolean;
    edit?: {
      phases?: { op?: string; index?: number; text?: string; description?: string }[];
      body?: string;
    };
  };

  const reply = data.reply?.trim();
  if (!reply) throw new Error('Agent did not return a reply');

  const edit = data.edit ? toEdit(data.edit) : undefined;

  return {
    reply,
    ...(data.answersQuestion ? { answersQuestion: true } : {}),
    ...(edit ? { edit } : {}),
  };
}

// Same one-shot read-only shape as replyToFeedback, fired once a chat session goes
// quiet (routes/agent.ts's feedback-summarize) instead of on every message.
export async function summarizeFeedback(
  plan: PlanEntry,
  messages: ThreadMessage[],
  runPrompt: (prompt: string, planTitle: string) => Promise<string>,
): Promise<string> {
  const prompt = buildFeedbackSummaryPrompt(plan, messages);
  const output = await runPrompt(prompt, plan.title);

  const jsonBlock = extractJsonBlock(output);
  if (!jsonBlock) throw new Error('Agent did not return a summary');

  const data = JSON.parse(jsonBlock) as { summary?: string };
  const summary = data.summary?.trim();
  if (!summary) throw new Error('Agent did not return a summary');
  return summary;
}

/** Applies a proposed edit's phase ops onto the entity's current phase/fix lists,
 * deterministically, so the entity file's grammar can't be corrupted by freeform agent edits.
 * A closed (done/archived) entity stays read-only: new phase-adds come back as `spawnFix` for
 * the caller to raise as a separate fix entity instead of reopening the closed one (IDEA-187).
 * A plan still under review routes new work to its own Fixes list instead. */
export function applyFeedbackEdit(
  entity: { phases: PhaseItem[]; fixes?: PhaseItem[]; status?: EntityStatus; archived?: boolean },
  edit: FeedbackEdit,
): { phases?: PhaseItem[]; fixes?: PhaseItem[]; body?: string; spawnFix?: PhaseItem[] } {
  const overrides: {
    phases?: PhaseItem[];
    fixes?: PhaseItem[];
    body?: string;
    spawnFix?: PhaseItem[];
  } = {};
  const closed = isClosedEntity(entity);
  if (edit.phases?.length) {
    const implemented = !closed && entity.status === 'review';
    const phases = [...entity.phases];
    const fixes = [...(entity.fixes ?? [])];
    const spawnFix: PhaseItem[] = [];
    for (const phaseEdit of edit.phases) {
      if (phaseEdit.op === 'add') {
        const item = { done: false, text: phaseEdit.text, description: phaseEdit.description };
        if (closed) spawnFix.push(item);
        else if (implemented) fixes.push(item);
        else phases.push(item);
      } else if (typeof phaseEdit.index === 'number' && !closed) {
        const i = phaseEdit.index - 1;
        if (phases[i]) {
          phases[i] = {
            ...phases[i],
            text: phaseEdit.text,
            description: phaseEdit.description ?? phases[i].description,
          };
        }
      }
    }
    if (!closed) overrides.phases = phases;
    if (implemented) overrides.fixes = fixes;
    if (spawnFix.length > 0) overrides.spawnFix = spawnFix;
  }
  if (edit.body && !closed) overrides.body = edit.body;
  return overrides;
}

/** True when applyFeedbackEdit's `fixes` override appended a new, still-open Fix —
 * used both to reopen an already-finished plan and to arm the fixes run's auto-launch. */
export function addsOpenFix(
  priorFixes: PhaseItem[] | undefined,
  fixes: PhaseItem[] | undefined,
): boolean {
  const priorFixCount = priorFixes?.length ?? 0;
  return (fixes ?? []).slice(priorFixCount).some((p) => !p.done);
}
