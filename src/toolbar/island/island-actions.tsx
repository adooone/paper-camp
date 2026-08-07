import type { StatusClientState } from '@/app/hooks/use-status-client';
import { Button } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';

const buttonStyle: CSSProperties = { fontSize: '0.75rem' };

export interface IslandActionsProps {
  status: StatusClientState;
  onCapture: () => void;
  onChat: () => void;
  onOpenDesk: () => void;
}

export const IslandActions = ({ status, onCapture, onChat, onOpenDesk }: IslandActionsProps) => (
  <>
    <Button
      variant="ghost"
      size="small"
      style={buttonStyle}
      disabled={status.gitActionBusy || status.gitBranchHygiene === 'clean-on-main'}
      onClick={status.onSync}
    >
      {status.syncing ? 'Syncing…' : 'Sync'}
    </Button>
    <Button
      variant="ghost"
      size="small"
      style={buttonStyle}
      disabled={status.gitActionBusy || status.gitAhead === 0}
      onClick={status.onPush}
    >
      {status.pushing ? 'Pushing…' : 'Push'}
    </Button>
    <Button
      variant="ghost"
      size="small"
      style={buttonStyle}
      disabled={status.commitInFlight || status.changedFileCount === 0}
      onClick={status.onQuickCommit}
    >
      {status.commitInFlight ? 'Committing…' : 'Commit'}
    </Button>
    <Button variant="ghost" size="small" style={buttonStyle} onClick={onCapture}>
      Capture
    </Button>
    <Button variant="ghost" size="small" style={buttonStyle} onClick={onChat}>
      Chat
    </Button>
    <Button variant="ghost" size="small" style={buttonStyle} onClick={onOpenDesk}>
      Desk
    </Button>
  </>
);
