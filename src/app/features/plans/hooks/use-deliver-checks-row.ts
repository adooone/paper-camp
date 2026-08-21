import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import type { ConsistencyIssue } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

export const useDeliverChecksRow = () => {
  const status = useAppStore((s) => s.status);
  const runConsistencyCheck = useAppStore((s) => s.runConsistencyCheck);
  const { checks: deskChecks, run: runDeskCheck } = useDeskChecks();
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const [docsExpanded, setDocsExpanded] = useState(false);

  const { qualityStatus, testStatus, consistencyStatus } = useMemo(
    () => deriveCheckStatuses(status, deskChecks),
    [status, deskChecks],
  );
  const anyRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  const hasDocIssues = consistency.length > 0;

  const linkedPlanFor = useCallback(
    (issue: ConsistencyIssue) =>
      issue.planId ? plans?.entries.find((p) => p.id === issue.planId) : undefined,
    [plans?.entries],
  );

  return {
    qualityStatus,
    testStatus,
    consistencyStatus,
    anyRunning,
    hasDocIssues,
    consistency,
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    runConsistencyCheck,
    linkedPlanFor,
  };
};
