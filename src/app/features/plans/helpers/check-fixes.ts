import type { CheckResult, DeskCheckState, PhaseItem } from '@/types/index';

const checkFixKey = (name: string) => `Fix the failing "${name}" check`;

const formatCheckDetail = ({ cmd, output }: CheckResult): string =>
  `The command was \`${cmd}\`.\n\nOutput from the last run:\n\n${output || '(no output captured)'}`;

/** Maps each failing `desk.checks` entry to one `PlanEntry.fixes` entry, in
 * manifest order, carrying the same command + last-output content the Stack
 * panel's `fixPrompt` copy-paste flow already builds. Docs findings keep their
 * own browse flow and are excluded (IDEA-156). */
export const buildCheckFixes = (deskChecks: DeskCheckState[]): PhaseItem[] =>
  deskChecks
    .filter((check) => check.status === 'fail')
    .map((check) => ({
      done: false,
      text: checkFixKey(check.name),
      description: `Fix the failing "${check.name}" check in this repo.\n\n${formatCheckDetail(check)}`,
    }));

/** Merges freshly-failing checks into an entity's existing `fixes`, keyed by check
 * name (`text`): a repeat failure replaces that entry's command/output in place,
 * preserving its position, instead of appending a duplicate. A newly-failing check
 * with no prior entry is appended. */
export const upsertCheckFixes = (
  existingFixes: PhaseItem[],
  deskChecks: DeskCheckState[],
): PhaseItem[] => {
  const nextByKey = new Map(buildCheckFixes(deskChecks).map((fix) => [fix.text, fix]));
  const merged = existingFixes.map((fix) => {
    const next = nextByKey.get(fix.text);
    if (!next) return fix;
    nextByKey.delete(fix.text);
    return next;
  });
  return [...merged, ...nextByKey.values()];
};
