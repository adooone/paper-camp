import { entityLink, entityRouteParam } from '@/app/hooks';
import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import type { DoctorFindingSummary, DoctorFindingWithSeverity } from '@/core/doctor';
import type { CheckStatus, ConsistencyIssue, DeskCheckState, PlanEntry } from '@/types/index';
import { CopyButton } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
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

export const fixPrompt = (check: DeskCheckState): string =>
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

const DoctorFindingRow = ({ finding }: { finding: DoctorFindingWithSeverity }) => (
  <div className="font-mono text-2xs opacity-70">
    {finding.file}:{finding.line} — {finding.message}
  </div>
);

const DocFindingRow = ({
  issue,
  linkedPlan,
  onNavigate,
}: {
  issue: ConsistencyIssue;
  linkedPlan: PlanEntry | undefined;
  onNavigate: () => void;
}) => (
  <div className="font-mono text-2xs opacity-70">
    {linkedPlan ? (
      <button
        type="button"
        onClick={onNavigate}
        className="bg-none bg-transparent border-none p-0 underline cursor-pointer [font:inherit] text-left"
      >
        {issue.message}
      </button>
    ) : (
      <span className="text-left">{issue.message}</span>
    )}
  </div>
);

export const ChecksGroup = () => {
  const { checks, run } = useDeskChecks();
  const doctor = useAppStore((s) => s.doctor);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const failing = checks.find((check) => check.status === 'fail');
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [doctorExpanded, setDoctorExpanded] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(false);

  const hasDoctorFindings = doctor.findings.length > 0;
  const hasDocFindings = consistency.length > 0;

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.planId ? plans?.entries.find((p) => p.id === issue.planId) : undefined,
    [plans?.entries],
  );

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
              hasDoctorFindings
                ? `${doctor.errorCount} error(s), ${doctor.warningCount} warning(s) — click to show.`
                : 'Corpus doctor — no findings.'
            }
            onClick={() => setDoctorExpanded((prev) => !prev)}
            disabled={!hasDoctorFindings}
            disabledCursor="default"
            ariaExpanded={hasDoctorFindings ? doctorExpanded : undefined}
            fillColor={chalkStatusFill[severityKey(doctor)]}
            textColor={chalkStatusText[severityKey(doctor)]}
          >
            doctor
          </StampButton>
          <StampButton
            tooltip={
              hasDocFindings
                ? 'Plan/idea doc findings — orphan subjects & title style. Click to show.'
                : 'Plan/idea docs — no findings.'
            }
            onClick={() => setDocsExpanded((prev) => !prev)}
            disabled={!hasDocFindings}
            disabledCursor="default"
            ariaExpanded={hasDocFindings ? docsExpanded : undefined}
            fillColor={chalkStatusFill[hasDocFindings ? 'fail' : 'pass']}
            textColor={chalkStatusText[hasDocFindings ? 'fail' : 'pass']}
          >
            docs
          </StampButton>
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
        {doctorExpanded && hasDoctorFindings && (
          <div className="flex flex-col gap-1">
            {doctor.findings.map((finding) => (
              <DoctorFindingRow
                key={`${finding.file}:${finding.line}:${finding.rule}`}
                finding={finding}
              />
            ))}
          </div>
        )}
        {docsExpanded && hasDocFindings && (
          <div className="flex flex-col gap-1">
            {consistency.map((issue, i) => {
              const linkedPlan = linkedPlanFor(issue);
              return (
                <DocFindingRow
                  key={`${issue.kind}-${issue.title}-${i}`}
                  issue={issue}
                  linkedPlan={linkedPlan}
                  onNavigate={() => linkedPlan && navigate(entityLink(linkedPlan))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
