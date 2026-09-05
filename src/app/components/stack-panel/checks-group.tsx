import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import type { DoctorFindingSummary } from '@/core/doctor';
import { collectCheckIssues } from '@/core/issues';
import type {
  AgentTaskState,
  CheckStatus,
  ConsistencyIssue,
  DeskCheckState,
  Issue,
} from '@/types/index';
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

type FailingCheck = Pick<Issue, 'id' | 'sourceKey' | 'title' | 'reason' | 'output'>;

/** Doctor and docs sit beside the desk checks as checks of their own, so a red
 * stamp of any kind is a failing check with the same Fix action. */
export const firstFailingCheck = (
  checks: DeskCheckState[],
  doctor: DoctorFindingSummary,
  consistency: ConsistencyIssue[],
): FailingCheck | null => {
  const deskIssue = collectCheckIssues(checks)[0];
  if (deskIssue) return deskIssue;
  if (doctor.errorCount > 0) {
    return {
      id: 'check:doctor',
      sourceKey: 'doctor',
      title: '"doctor" check is failing',
      reason: 'The command was `paper-camp doctor`.',
      output: doctor.findings
        .filter((finding) => finding.severity === 'error')
        .map((finding) => `${finding.file}:${finding.line} — ${finding.message}`)
        .join('\n'),
    };
  }
  if (consistency.length > 0) {
    return {
      id: 'check:docs',
      sourceKey: 'docs',
      title: '"docs" check is failing',
      reason: 'The plan/idea doc consistency check found orphan subjects or title-style issues.',
      output: consistency.map((issue) => issue.message).join('\n'),
    };
  }
  return null;
};

const isActiveFix = (task: AgentTaskState) =>
  task.taskKind === 'issue-fix' &&
  task.status !== 'done' &&
  task.status !== 'error' &&
  task.status !== 'superseded';

/** The issue-fix task currently working on a check, if any — the Fix stamp reads
 * `fixing…` for its own check and stays disabled while another fix is in flight. */
export const activeCheckFix = (
  agentStatus: AgentTaskState[],
  issueId: string,
): 'own' | 'other' | null => {
  const active = agentStatus.find(isActiveFix);
  if (!active) return null;
  return active.issueId === issueId ? 'own' : 'other';
};

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
  const { checks, run } = useDeskChecks();
  const doctor = useAppStore((s) => s.doctor);
  const consistency = useAppStore((s) => s.consistency);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const failing = firstFailingCheck(checks, doctor, consistency);
  const fixState = failing ? activeCheckFix(agentStatus, failing.id) : null;

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
              <StampButton
                tooltip={
                  fixState === 'own'
                    ? 'An agent is fixing this check.'
                    : fixState === 'other'
                      ? 'Another fix is in flight — wait for it to finish.'
                      : `Send an agent to fix the ${failing.sourceKey} check.`
                }
                onClick={() =>
                  launchIssueFix(failing.id, failing.title, failing.reason, failing.output)
                }
                disabled={fixState !== null}
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
