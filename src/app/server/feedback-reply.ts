import { buildFeedbackReplyPrompt, buildFeedbackSummaryPrompt } from '@/app/features/plans/prompts';
import type {
  EntityEntry,
  EntityStatus,
  FeedbackEdit,
  FeedbackPhaseEdit,
  FeedbackReplyResult,
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

// Claude's `-p --output-format json` wraps the model's own text in a {result: "..."}
// envelope; opencode's `--format json` does not. Unwrap either shape, then pull the
// JSON object the prompt's contract requires as the final line.
function extractJsonBlock(output: string): string | null {
  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}
  return resultText.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

// One-shot, read-only agent call, not the long-running phase/task system in
// agent.ts: runs independently of the task registry, so it's never blocked by
// (and never blocks) a running phase/reconcile/etc. Never edits a file itself —
// the route applies the edit this returns, via applyFeedbackEdit below. This chat
// never creates new ideas — a request always becomes an edit on the current plan.
export async function replyToFeedback(
  plan: PlanEntry,
  otherEntities: EntityEntry[],
  runPrompt: (prompt: string, planTitle: string) => Promise<string>,
): Promise<FeedbackReplyResult> {
  const prompt = buildFeedbackReplyPrompt(plan, otherEntities);
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

// Applies a proposed edit's phase ops onto the entity's current phase/fix lists —
// deterministic in the app, never as freeform file edits by the agent, so the
// entity file's grammar (frontmatter, Phases, Fixes, Thread) can never be corrupted.
export function applyFeedbackEdit(
  entity: { phases: PhaseItem[]; fixes?: PhaseItem[]; status?: EntityStatus },
  edit: FeedbackEdit,
): { phases?: PhaseItem[]; fixes?: PhaseItem[]; body?: string } {
  const overrides: { phases?: PhaseItem[]; fixes?: PhaseItem[]; body?: string } = {};
  if (edit.phases?.length) {
    // A plan already landed in review/done has its Phases history finished — new
    // work an edit adds belongs in Fixes instead, so it never rewrites that history.
    const implemented = entity.status === 'review' || entity.status === 'done';
    const phases = [...entity.phases];
    const fixes = [...(entity.fixes ?? [])];
    for (const phaseEdit of edit.phases) {
      if (phaseEdit.op === 'add') {
        const item = { done: false, text: phaseEdit.text, description: phaseEdit.description };
        if (implemented) fixes.push(item);
        else phases.push(item);
      } else if (typeof phaseEdit.index === 'number') {
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
    overrides.phases = phases;
    if (implemented) overrides.fixes = fixes;
  }
  if (edit.body) overrides.body = edit.body;
  return overrides;
}
