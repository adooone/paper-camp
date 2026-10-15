import { CommitMessageFields } from '@/app/components';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, IconButton, PullIcon, PushIcon } from '@dendelion/paper-ui';
import { useMemo } from 'react';
import { DeliverChecksRow, DeliverCommitButton } from '../components';
import { useDeliverCommitForm } from '../hooks';

const gitStateLine = (hasChanges: boolean, fileCount: number, gitAhead: number): string => {
  if (hasChanges) return `${fileCount} file${fileCount === 1 ? '' : 's'} changed`;
  if (gitAhead > 0) return `${gitAhead} commit${gitAhead === 1 ? '' : 's'} ready`;
  return 'Up to date with origin';
};

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
  const { pushing, pulling, gitActionBusy, handlePush, handlePull } = useBranchSync();
  const hasChanges = files.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DeliverChecksRow />
        <span className="text-desk-text-muted text-xs">
          {gitStateLine(hasChanges, files.length, gitAhead)}
        </span>
        <div className="flex-1" />
        {gitAhead > 0 && (
          <Button
            size="small"
            icon={<PushIcon size={14} />}
            disabled={gitActionBusy}
            onClick={handlePush}
          >
            {pushing ? 'Pushing…' : `Push ${gitAhead}`}
          </Button>
        )}
        <IconButton
          icon={<PullIcon size={14} />}
          variant="ghost"
          size="small"
          label={pulling ? 'Pulling…' : 'Pull'}
          disabled={gitActionBusy}
          onClick={handlePull}
        />
      </div>
      {hasChanges && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CommitMessageFields state={commitForm} filesEmpty={false} />
          </div>
          <DeliverCommitButton state={commitForm} filesEmpty={false} />
        </div>
      )}
    </div>
  );
};
