import { entityRouteParam } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { DoctorFindingSummary, DoctorFindingWithSeverity } from '@/core/doctor';
import type { ConsistencyIssue, PlanEntry } from '@/types/index';
import { Divider } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { StampButton, chalkStatusFill, chalkStatusText, sectionLabelClassName } from './shared';

const severityKey = (summary: DoctorFindingSummary): 'pass' | 'fail' | 'running' =>
  summary.errorCount > 0 ? 'fail' : summary.warningCount > 0 ? 'running' : 'pass';

const HealthStamp = ({
  label,
  fillKey,
  hasFindings,
  expanded,
  onToggle,
  tooltip,
}: {
  label: string;
  fillKey: 'pass' | 'fail' | 'running';
  hasFindings: boolean;
  expanded: boolean;
  onToggle: () => void;
  tooltip: string;
}) => (
  <StampButton
    tooltip={tooltip}
    onClick={onToggle}
    disabled={!hasFindings}
    disabledCursor="default"
    ariaExpanded={hasFindings ? expanded : undefined}
    fillColor={chalkStatusFill[fillKey]}
    textColor={chalkStatusText[fillKey]}
  >
    {label}
  </StampButton>
);

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

export const HealthSection = () => {
  const doctor = useAppStore((s) => s.doctor);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
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
    <>
      <Divider surface="chalkboard" />
      <div className="flex flex-none flex-col gap-3 p-6">
        <div className={sectionLabelClassName}>Health</div>
        <div className="flex flex-wrap gap-2">
          <HealthStamp
            label="doctor"
            fillKey={severityKey(doctor)}
            hasFindings={hasDoctorFindings}
            expanded={doctorExpanded}
            onToggle={() => setDoctorExpanded((prev) => !prev)}
            tooltip={
              hasDoctorFindings
                ? `${doctor.errorCount} error(s), ${doctor.warningCount} warning(s) — click to show.`
                : 'Corpus doctor — no findings.'
            }
          />
          <HealthStamp
            label="docs"
            fillKey={hasDocFindings ? 'fail' : 'pass'}
            hasFindings={hasDocFindings}
            expanded={docsExpanded}
            onToggle={() => setDocsExpanded((prev) => !prev)}
            tooltip={
              hasDocFindings
                ? 'Plan/idea doc findings — orphan subjects & title style. Click to show.'
                : 'Plan/idea docs — no findings.'
            }
          />
        </div>
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
                  onNavigate={() =>
                    linkedPlan &&
                    navigate({
                      to: '/plans/$planId',
                      params: { planId: entityRouteParam(linkedPlan.id, linkedPlan.title) },
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
