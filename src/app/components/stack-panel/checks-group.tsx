import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import type { CheckStatus, DeskCheckState } from '@/types/index';
import { Card, CopyButton } from '@dendelion/paper-ui';
import { useState } from 'react';
import {
  StampButton,
  chalkStatusFill,
  chalkStatusText,
  formatLastRun,
  groupLabelClassName,
} from './shared';

export const CHECKS_GROUP_LABEL = 'Checks';

const statusFill: Record<CheckStatus, string | undefined> = {
  ...chalkStatusFill,
  stale: undefined,
};
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
  const lastRun = formatLastRun(check.lastRun);
  return (
    <div className="flex items-center justify-between gap-2">
      <StampButton
        tooltip={`${check.cmd} — click to run.`}
        onClick={() => onRun(check.name)}
        disabled={running}
        fillColor={statusFill[check.status]}
        textColor={statusText[check.status]}
        variant={check.status === 'stale' ? 'neutral' : undefined}
      >
        {check.name}
        <span className={running ? 'visible' : 'invisible'}>…</span>
      </StampButton>
      {lastRun && (
        <span className="shrink-0 font-mono text-2xs text-desk-text-muted">{lastRun}</span>
      )}
    </div>
  );
};

export const ChecksGroup = () => {
  const { checks, run } = useDeskChecks();
  const failing = checks.find((check) => check.status === 'fail');
  const [outputExpanded, setOutputExpanded] = useState(false);

  return (
    <div>
      <h4 className={`${groupLabelClassName} m-0`}>{CHECKS_GROUP_LABEL}</h4>
      {checks.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {checks.map((check) => (
              <CheckStamp key={check.name} check={check} onRun={run} />
            ))}
          </div>
          {failing && (
            <div className="flex flex-col gap-1 text-center font-handwritten text-sm">
              <span className="text-desk-text-muted">The {failing.name} check failed.</span>
              <span className="text-desk-chalk">
                Suggested fix: <CopyButton text={fixPrompt(failing)} surface="chalkboard" />
                {failing.output && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setOutputExpanded((prev) => !prev)}
                      className="bg-none bg-transparent border-none p-0 underline cursor-pointer [font:inherit] text-desk-chalk"
                      aria-expanded={outputExpanded}
                    >
                      {outputExpanded ? 'Hide output' : 'Show output'}
                    </button>
                  </>
                )}
              </span>
              {outputExpanded && failing.output && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-left font-mono text-2xs opacity-70">
                  {failing.output}
                </pre>
              )}
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
