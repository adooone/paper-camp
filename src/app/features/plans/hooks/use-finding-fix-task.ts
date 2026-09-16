import { useAppStore } from '@/app/stores/app-store';
import { nightFindingKey, nightFindingTitle } from '@/core/night-findings';
import type { AgentTaskState, NightSuggestionEntry, TaskLogEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { sortedFindings } from '../views/night-report-section';

const ACTIVE_STATUSES = new Set(['starting', 'running', 'stopping']);

export function findingIssueId(finding: NightSuggestionEntry): string {
  return `night-finding:${nightFindingKey(finding)}`;
}

export function findingsIssueId(findings: NightSuggestionEntry[]): string {
  if (findings.length === 1) return findingIssueId(findings[0]);
  const [{ date, chunk }] = findings;
  return `night-chunk:${date}:${chunk}`;
}

export function findingFixReason(finding: NightSuggestionEntry): string {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  return `${finding.message}\n\nFound by the night shift's \`${finding.check}\` check in \`${finding.chunk}\`, at ${location} (commit ${finding.commit.slice(0, 7)}, severity: ${finding.severity}).`;
}

function findingsFixReason(findings: NightSuggestionEntry[]): string {
  return sortedFindings(findings).map(findingFixReason).join('\n\n');
}

function findingsFixTitle(findings: NightSuggestionEntry[]): string {
  if (findings.length === 1) return nightFindingTitle(findings[0]);
  const [{ chunk }] = findings;
  return `${chunk}: ${findings.length} findings`;
}

/** Drives "Fix it here" and "Fix all" alike — launches the same `issue-fix` shape
 * the checks group uses, over one finding or a whole chunk's, then watches for that
 * task's own outcome so the caller can show it. A `done` outcome removes every finding
 * in the list the way `promoteNightFinding` removes one on the idea path (IDEA-271). */
export const useFindingFixTask = (findings: NightSuggestionEntry[]) => {
  const issueId = findingsIssueId(findings);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const taskLog = useAppStore((s) => s.taskLog);
  const loadTaskLog = useAppStore((s) => s.loadTaskLog);
  const launchIssueFix = useAppStore((s) => s.launchIssueFix);
  const dismissNightFinding = useAppStore((s) => s.dismissNightFinding);
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const handledEntryId = useRef<string | null>(null);

  useEffect(() => {
    loadTaskLog();
  }, [loadTaskLog]);

  const activeTask: AgentTaskState | undefined = agentStatus.find(
    (task) =>
      task.taskKind === 'issue-fix' && task.issueId === issueId && ACTIVE_STATUSES.has(task.status),
  );

  const outcome: TaskLogEntry | undefined = taskLog
    .filter((entry) => entry.issueId === issueId && Boolean(entry.endedAt))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];

  useEffect(() => {
    if (outcome?.outcome !== 'done') return;
    if (handledEntryId.current === outcome.id) return;
    handledEntryId.current = outcome.id;
    Promise.all(findings.map((finding) => dismissNightFinding(finding))).then(() => {
      if (findings.length === 1) navigate({ to: '/' });
    });
  }, [outcome, dismissNightFinding, findings, navigate]);

  const launchFix = async () => {
    setLaunching(true);
    try {
      await launchIssueFix(
        issueId,
        findingsFixTitle(findings),
        findingsFixReason(findings),
        undefined,
      );
    } finally {
      setLaunching(false);
    }
  };

  return { activeTask, outcome, launching, launchFix };
};
