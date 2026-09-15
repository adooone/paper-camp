import { useAppStore } from '@/app/stores/app-store';
import { nightFindingKey, nightFindingTitle } from '@/core/night-findings';
import type { AgentTaskState, NightSuggestionEntry, TaskLogEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const ACTIVE_STATUSES = new Set(['starting', 'running', 'stopping']);

export function findingIssueId(finding: NightSuggestionEntry): string {
  return `night-finding:${nightFindingKey(finding)}`;
}

function findingFixReason(finding: NightSuggestionEntry): string {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  return `${finding.message}\n\nFound by the night shift's \`${finding.check}\` check in \`${finding.chunk}\`, at ${location} (commit ${finding.commit.slice(0, 7)}, severity: ${finding.severity}).`;
}

/** Drives the finding page's "Fix it here" — launches the same `issue-fix` shape
 * the checks group uses, then watches for that task's own outcome so the page can
 * show it. A green landing removes the line the way a promoted finding's does,
 * the way `promoteNightFinding` removes it on the idea path (IDEA-271). */
export const useFindingFixTask = (finding: NightSuggestionEntry) => {
  const issueId = findingIssueId(finding);
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
    dismissNightFinding(finding).then(() => navigate({ to: '/' }));
  }, [outcome, dismissNightFinding, finding, navigate]);

  const launchFix = async () => {
    setLaunching(true);
    try {
      await launchIssueFix(
        issueId,
        nightFindingTitle(finding),
        findingFixReason(finding),
        undefined,
      );
    } finally {
      setLaunching(false);
    }
  };

  return { activeTask, outcome, launching, launchFix };
};
