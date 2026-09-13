import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import type { DoctorFindingSummary } from '@/core/doctor';
import { collectCheckIssues } from '@/core/issues';
import type { AgentTaskState, ConsistencyIssue, DeskCheckState, Issue } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

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

export const useDeliverChecksRow = () => {
  const { checks: deskChecks, run: runDeskCheck, fix } = useDeskChecks();
  const doctor = useAppStore((s) => s.doctor);
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const navigate = useNavigate();
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [fixingName, setFixingName] = useState<string | null>(null);

  const anyRunning = deskChecks.some((check) => check.status === 'running');
  const hasDocIssues = consistency.length > 0;

  const failing = firstFailingCheck(deskChecks, doctor, consistency);
  const failingCheck = failing ? deskChecks.find((c) => c.name === failing.sourceKey) : undefined;
  const fixState = failing ? activeCheckFix(agentStatus, failing.id) : null;
  const fixing = fixingName !== null && fixingName === failingCheck?.name;

  const runAutoFix = async (name: string) => {
    setFixingName(name);
    try {
      await fix(name);
    } finally {
      setFixingName(null);
    }
  };

  const fixCheck = () => {
    if (!failing) return;
    launchIssueFix(failing.id, failing.title, failing.reason, failing.output);
  };

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.planId ? plans?.entries.find((p) => p.id === issue.planId) : undefined,
    [plans?.entries],
  );

  return {
    deskChecks,
    anyRunning,
    hasDocIssues,
    consistency,
    doctor,
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    linkedPlanFor,
    failing,
    failingCheck,
    fixState,
    fixing,
    runAutoFix,
    fixCheck,
  };
};
