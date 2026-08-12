import type { StatusState } from '@/app/services/status-api';
import type { CheckResult, PhaseItem } from '@/types/index';

const CHECK_GROUPS: { name: string; keys: ('lint' | 'format' | 'test' | 'consistency')[] }[] = [
  { name: 'Quality', keys: ['lint', 'format'] },
  { name: 'Tests', keys: ['test'] },
  { name: 'Consistency', keys: ['consistency'] },
];

const formatCheckDetail = ({ cmd, output }: CheckResult): string =>
  `The command was \`${cmd}\`.\n\nOutput from the last run:\n\n${output || '(no output captured)'}`;

/** Maps each failing Quality/Tests/Consistency check to one `PlanEntry.fixes` entry,
 * carrying the same command + last-output content the Stack panel's `fixPrompt`
 * copy-paste flow already builds. Docs findings keep their own browse flow and are
 * excluded (IDEA-156). */
export const buildCheckFixes = (status: StatusState): PhaseItem[] =>
  CHECK_GROUPS.flatMap(({ name, keys }) => {
    const failing = keys.map((key) => status[key]).filter((result) => result.status === 'fail');
    if (failing.length === 0) return [];
    const details = failing.map(formatCheckDetail).join('\n\n');
    return [
      {
        done: false,
        text: `Fix the failing "${name}" check`,
        description: `Fix the failing "${name}" check in this repo.\n\n${details}`,
      },
    ];
  });
