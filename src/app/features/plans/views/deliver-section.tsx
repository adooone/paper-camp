import { DeliverBar } from '@/app/components';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { useMemo } from 'react';
import { DeliverCommitButton } from '../components';
import { useDeliverCommitForm } from '../hooks';

// Always rendered as the Phases table's panelFooter — never hidden, so it
// reads as a persistent Deliver station, not something gated on having changes.
interface DeliverSectionProps {
  plan: PlanEntry;
}

export const DeliverSection = ({ plan }: DeliverSectionProps) => {
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const files = useMemo(
    () => gitStatus?.map((entry) => ({ path: entry.path, staged: entry.staged })) ?? [],
    [gitStatus],
  );
  const commitForm = useDeliverCommitForm(plan, files);

  return (
    <DeliverBar
      files={files}
      gitAhead={gitAhead}
      commitForm={commitForm}
      commitButton={<DeliverCommitButton state={commitForm} filesEmpty={false} />}
    />
  );
};
