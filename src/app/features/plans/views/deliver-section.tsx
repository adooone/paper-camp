import { CommitMessageFields } from '@/app/components';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { useMemo } from 'react';
import {
  DeliverChangedFiles,
  DeliverChecksRow,
  DeliverCommitButton,
  DeliverEmptyState,
  useDeliverCommitForm,
} from '../components';

// Always rendered as the Phases table's panelFooter — never hidden, so the
// panel reads as a persistent Deliver station rather than something that
// pops in only once there happens to be a change to commit.
interface DeliverSectionProps {
  plan: PlanEntry;
}

export const DeliverSection = ({ plan }: DeliverSectionProps) => {
  const gitStatus = useAppStore((s) => s.gitStatus);
  const files = useMemo(
    () => gitStatus?.map((entry) => ({ path: entry.path, staged: entry.staged })) ?? [],
    [gitStatus],
  );
  const commitForm = useDeliverCommitForm(plan, files);
  const hasChanges = files.length > 0;
  return (
    // One centred column in both states. min-h keeps the footer from resizing as it
    // switches between them.
    <div className="flex min-h-[7rem] flex-col items-center justify-center gap-3">
      <DeliverChecksRow />
      {hasChanges ? (
        <>
          {/* Bounded width: the commit input would otherwise stretch the full sheet
              and stop reading as one centred group with the row below it. */}
          <div className="w-full max-w-md">
            <CommitMessageFields state={commitForm} filesEmpty={false} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <DeliverChangedFiles count={files.length} />
            <DeliverCommitButton state={commitForm} filesEmpty={false} />
          </div>
        </>
      ) : (
        <DeliverEmptyState />
      )}
    </div>
  );
};
