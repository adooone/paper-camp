import { buildFeedbackReplyPrompt } from '@/app/features/plans/prompts';
import type {
  FeedbackEdit,
  FeedbackPhaseEdit,
  FeedbackReplyResult,
  PhaseItem,
  PlanEntry,
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

// One-shot, read-only agent call, not the long-running phase/task system in
// agent.ts: runs independently of the task registry, so it's never blocked by
// (and never blocks) a running phase/reconcile/etc. Never edits a file itself —
// the route applies the edit/spinOff this returns, via applyFeedbackEdit below.
export async function replyToFeedback(
  plan: PlanEntry,
  runPrompt: (prompt: string, planTitle: string) => Promise<string>,
): Promise<FeedbackReplyResult> {
  const prompt = buildFeedbackReplyPrompt(plan);
  const output = await runPrompt(prompt, plan.title);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a reply');

  const data = JSON.parse(match[0]) as {
    reply?: string;
    edit?: {
      phases?: { op?: string; index?: number; text?: string; description?: string }[];
      body?: string;
    };
    spinOff?: { title?: string; body?: string };
  };

  const reply = data.reply?.trim();
  if (!reply) throw new Error('Agent did not return a reply');

  const edit = data.edit ? toEdit(data.edit) : undefined;
  const spinOff =
    data.spinOff?.title?.trim() && data.spinOff?.body?.trim()
      ? { title: data.spinOff.title.trim(), body: data.spinOff.body.trim() }
      : undefined;

  return { reply, ...(edit ? { edit } : {}), ...(spinOff && !edit ? { spinOff } : {}) };
}

// Applies a proposed edit's phase ops onto the entity's current phase list —
// deterministic in the app, never as freeform file edits by the agent, so the
// entity file's grammar (frontmatter, Phases, Thread) can never be corrupted.
export function applyFeedbackEdit(
  phases: PhaseItem[],
  edit: FeedbackEdit,
): { phases?: PhaseItem[]; body?: string } {
  const overrides: { phases?: PhaseItem[]; body?: string } = {};
  if (edit.phases?.length) {
    const next = [...phases];
    for (const phaseEdit of edit.phases) {
      if (phaseEdit.op === 'add') {
        next.push({ done: false, text: phaseEdit.text, description: phaseEdit.description });
      } else if (typeof phaseEdit.index === 'number') {
        const i = phaseEdit.index - 1;
        if (next[i]) {
          next[i] = {
            ...next[i],
            text: phaseEdit.text,
            description: phaseEdit.description ?? next[i].description,
          };
        }
      }
    }
    overrides.phases = next;
  }
  if (edit.body) overrides.body = edit.body;
  return overrides;
}
