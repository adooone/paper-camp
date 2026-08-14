import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import type { CheckStatus, DeskCheckState } from '@/types/index';
import { Card, CopyButton, Stamp, Tooltip } from '@dendelion/paper-ui';
import { chalkStatusFill, chalkStatusText, groupLabelClassName } from './shared';

export const CHECKS_GROUP_LABEL = 'Checks';

const statusFill: Record<CheckStatus, string> = { ...chalkStatusFill, stale: 'transparent' };
const statusText: Record<CheckStatus, string | undefined> = {
  ...chalkStatusText,
  stale: undefined,
};

const fixPrompt = (check: DeskCheckState): string =>
  `Fix the failing "${check.name}" check in this repo. The command was \`${check.cmd}\`.\n\nOutput from the last run:\n\n${check.output || '(no output captured)'}`;

const CheckStamp = ({
  check,
  onRun,
}: {
  check: DeskCheckState;
  onRun: (name: string) => void;
}) => {
  const running = check.status === 'running';
  return (
    <Tooltip content={`${check.cmd} — click to run.`} surface="chalkboard">
      {/* Raw <button>: the clickable target is a Stamp, which has no button surface of its own. */}
      <button
        type="button"
        className={`inline-flex border-none bg-transparent bg-none p-0 ${running ? 'cursor-not-allowed' : 'cursor-pointer enabled:hover:-translate-y-px enabled:hover:brightness-[1.15]'}`}
        onClick={() => {
          if (!running) onRun(check.name);
        }}
        disabled={running}
      >
        <Stamp
          surface="chalkboard"
          size="small"
          fillColor={statusFill[check.status]}
          textColor={statusText[check.status]}
        >
          {check.name}
          <span className={running ? 'visible' : 'invisible'}>…</span>
        </Stamp>
      </button>
    </Tooltip>
  );
};

export const ChecksGroup = () => {
  const { checks, run } = useDeskChecks();
  const failing = checks.find((check) => check.status === 'fail');

  return (
    <div>
      <div className={groupLabelClassName}>{CHECKS_GROUP_LABEL}</div>
      {checks.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {checks.map((check) => (
              <CheckStamp key={check.name} check={check} onRun={run} />
            ))}
          </div>
          {failing && (
            <div className="flex flex-col gap-1 text-center font-handwritten text-sm">
              <span className="text-desk-text-muted">The {failing.name} check failed.</span>
              <span className="text-desk-chalk">
                Suggested fix: <CopyButton text={fixPrompt(failing)} surface="chalkboard" />
              </span>
            </div>
          )}
        </div>
      ) : (
        <Card surface="chalkboard" size="small">
          <p className="m-0 text-center text-xs opacity-50">No checks declared.</p>
        </Card>
      )}
    </div>
  );
};
