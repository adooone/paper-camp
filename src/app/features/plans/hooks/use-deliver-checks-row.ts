import { useDeskChecks } from '@/app/hooks/use-desk-checks';
import { useAppStore } from '@/app/stores/app-store';
import type { ConsistencyIssue } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

export const useDeliverChecksRow = () => {
  const { checks: deskChecks, run: runDeskCheck } = useDeskChecks();
  const consistency = useAppStore((s) => s.consistency);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();
  const [docsExpanded, setDocsExpanded] = useState(false);

  const anyRunning = deskChecks.some((check) => check.status === 'running');
  const hasDocIssues = consistency.length > 0;

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
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    linkedPlanFor,
  };
};
