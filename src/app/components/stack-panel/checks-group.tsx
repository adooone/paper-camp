import { useDeliverChecksRow } from '@/app/features/plans/hooks';
import type { DoctorFindingSummary } from '@/core/doctor';
import type { CheckStatus, DeskCheckState } from '@/types/index';
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

const severityKey = (summary: DoctorFindingSummary): 'pass' | 'fail' | 'running' =>
  summary.errorCount > 0 ? 'fail' : summary.warningCount > 0 ? 'running' : 'pass';

// Fixed height whether a check is failing or not, so the group never shifts.
const fixRowClass =
  'flex h-8 items-center justify-center gap-2 font-handwritten text-sm text-desk-text-muted';

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
    <StampButton
      tooltip={
        lastRun
          ? `${check.cmd} — last run ${lastRun}. Click to run.`
          : `${check.cmd} — click to run.`
      }
      onClick={() => onRun(check.name)}
      disabled={running}
      fillColor={statusFill[check.status]}
      textColor={statusText[check.status]}
      variant={check.status === 'stale' ? 'neutral' : undefined}
    >
      {check.name}
      <span className={running ? 'visible' : 'invisible'}>…</span>
    </StampButton>
  );
};

export const ChecksGroup = () => {
  const {
    deskChecks: checks,
    runDeskCheck: run,
    doctor,
    consistency,
    failing,
    failingCheck,
    fixState,
    fixing,
    runAutoFix,
    fixCheck,
  } = useDeliverChecksRow();

  return (
    <div>
      <h4 className={`${groupLabelClassName} m-0`}>{CHECKS_GROUP_LABEL}</h4>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {checks.map((check) => (
            <CheckStamp key={check.name} check={check} onRun={run} />
          ))}
          <StampButton
            tooltip={
              doctor.findings.length > 0
                ? `Corpus doctor — ${doctor.errorCount} error(s), ${doctor.warningCount} warning(s).`
                : 'Corpus doctor — no findings.'
            }
            onClick={() => {}}
            disabled
            disabledCursor="default"
            fillColor={chalkStatusFill[severityKey(doctor)]}
            textColor={chalkStatusText[severityKey(doctor)]}
          >
            doctor
          </StampButton>
          <StampButton
            tooltip={
              consistency.length > 0
                ? `Plan/idea docs — ${consistency.length} finding(s): orphan subjects or title style.`
                : 'Plan/idea docs — no findings.'
            }
            onClick={() => {}}
            disabled
            disabledCursor="default"
            fillColor={chalkStatusFill[consistency.length > 0 ? 'fail' : 'pass']}
            textColor={chalkStatusText[consistency.length > 0 ? 'fail' : 'pass']}
          >
            docs
          </StampButton>
        </div>
        <div className={fixRowClass}>
          {failing ? (
            <>
              <span>The {failing.sourceKey} check failed.</span>
              {failingCheck?.fixCmd && (
                <StampButton
                  tooltip={
                    fixing
                      ? 'Running the fix command…'
                      : `Run \`${failingCheck.fixCmd}\`, then re-check.`
                  }
                  onClick={() => runAutoFix(failingCheck.name)}
                  disabled={fixing || fixState !== null}
                  fillColor={statusFill[failingCheck.status]}
                  textColor={statusText[failingCheck.status]}
                >
                  {fixing ? 'fixing…' : 'auto-fix'}
                </StampButton>
              )}
              <StampButton
                tooltip={
                  fixState === 'own'
                    ? 'An agent is fixing this check.'
                    : fixState === 'other'
                      ? 'Another fix is in flight — wait for it to finish.'
                      : `Send an agent to fix the ${failing.sourceKey} check.`
                }
                onClick={fixCheck}
                disabled={fixState !== null || fixing}
                fillColor={chalkStatusFill.fail}
                textColor={chalkStatusText.fail}
              >
                {fixState === 'own' ? 'fixing…' : 'fix'}
              </StampButton>
            </>
          ) : (
            <span>{checks.length === 0 ? 'No checks configured.' : 'No failing checks.'}</span>
          )}
        </div>
      </div>
    </div>
  );
};
