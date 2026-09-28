const DECISION_MARKER = 'needs a decision: ';

/** `escalateToLog` composes a `[question]` message's `text` as a phase-context
 * lead-in followed by the bare question (agent.ts); split it back apart so a
 * bell notification can show the question alone and a card can show the
 * lead-in muted above it. */
export function splitQuestionText(text: string): { phaseLine?: string; question: string } {
  const idx = text.lastIndexOf(DECISION_MARKER);
  if (idx === -1) return { question: text };
  const phaseLine = text
    .slice(0, idx)
    .replace(/[—-]\s*$/, '')
    .trim();
  return {
    phaseLine: phaseLine || undefined,
    question: text.slice(idx + DECISION_MARKER.length).trim(),
  };
}
