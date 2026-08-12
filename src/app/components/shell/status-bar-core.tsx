import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { AgentTaskStatus, BranchHygieneStatus, RateLimitSnapshot } from '@/types/index';
import { Button, IconButton, Spinner, Stamp, Tooltip, getTextureStyles } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';
import { BellIcon, CommitIcon, MergeIcon, PullIcon, PushIcon } from '../icons';

function capacityTooltip(snapshot: RateLimitSnapshot): string {
  const parts = [`Claude usage: ${snapshot.status}`];
  if (snapshot.rateLimitType) parts.push(snapshot.rateLimitType);
  if (snapshot.resetsAt !== undefined)
    parts.push(`resets ${new Date(resetsAtMs(snapshot.resetsAt)).toLocaleTimeString()}`);
  if (snapshot.overage) parts.push('overage on');
  return parts.join(' · ');
}

const barStyle: CSSProperties = {
  ...getTextureStyles('kraft'),
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  height: '2rem',
  paddingLeft: '1rem',
  paddingRight: '1rem',
  borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  fontSize: '0.75rem',
  flexShrink: 0,
  boxSizing: 'border-box',
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'nowrap',
};
const leftGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexShrink: 0,
};
const branchStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.25rem' };
const mutedStyle: CSSProperties = { opacity: 0.5 };
const branchNameStyle: CSSProperties = { color: 'var(--pui-text-primary)' };
const secondaryStyle: CSSProperties = { opacity: 0.6 };
const spacerStyle: CSSProperties = { flex: 1 };
const rightGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
};
const buttonTextStyle: CSSProperties = { fontSize: '0.75rem' };
const stampTriggerStyle: CSSProperties = {
  background: 'none',
  backgroundColor: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
};
const notificationButtonStyle: CSSProperties = { position: 'relative', display: 'inline-flex' };
const notificationBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: '-0.25rem',
  right: '-0.25rem',
};

export interface StatusBarCoreProps {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  agentActive: boolean;
  activeTaskStatus?: AgentTaskStatus;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  rateLimit?: RateLimitSnapshot | null;
  gitBranchHygiene: BranchHygieneStatus | null;
  commitInFlight: boolean;
  gitActionBusy: boolean;
  pushing: boolean;
  syncing: boolean;
  pulling: boolean;
  unreadNotificationCount: number;
  onSync: () => void;
  onPush: () => void;
  onPull: () => void;
  onQuickCommit: () => void;
  onOpenSetup: () => void;
  onOpenNotifications: () => void;
  trailing?: ReactNode;
}

// Ambient status + immediate quick actions; the Stack panel remains the full control surface.
export const StatusBarCore = ({
  gitBranch,
  gitAhead,
  changedFileCount,
  agentActive,
  activeTaskStatus,
  agentNotSignedIn,
  capabilityGapCount,
  rateLimit,
  gitBranchHygiene,
  commitInFlight,
  gitActionBusy,
  pushing,
  syncing,
  pulling,
  unreadNotificationCount,
  onSync,
  onPush,
  onPull,
  onQuickCommit,
  onOpenSetup,
  onOpenNotifications,
  trailing,
}: StatusBarCoreProps) => {
  return (
    <div style={barStyle}>
      <div style={leftGroupStyle}>
        <span style={branchStyle}>
          <span style={mutedStyle}>⌥</span>
          <code style={branchNameStyle}>{gitBranch ?? 'no branch'}</code>
        </span>
        {gitAhead > 0 && <span style={secondaryStyle}>↑{gitAhead}</span>}
        <span style={secondaryStyle}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {agentActive && <Spinner size="small" label={`Agent ${activeTaskStatus}…`} />}
        {agentNotSignedIn && (
          <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button type="button" onClick={onOpenSetup} style={stampTriggerStyle}>
              <Stamp size="small" variant="warning">
                Agent not signed in
              </Stamp>
            </button>
          </Tooltip>
        )}
        {capabilityGapCount > 0 && (
          <Tooltip content="Some features are disabled — open Setup to fix">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button type="button" onClick={onOpenSetup} style={stampTriggerStyle}>
              <Stamp size="small" variant="warning">
                Setup ({capabilityGapCount})
              </Stamp>
            </button>
          </Tooltip>
        )}
        {rateLimit && capacityLevel(rateLimit.status) !== 'allowed' && (
          <Tooltip content={capacityTooltip(rateLimit)}>
            <Stamp
              size="small"
              variant={capacityLevel(rateLimit.status) === 'rejected' ? 'error' : 'warning'}
            >
              {capacityLevel(rateLimit.status) === 'rejected'
                ? 'Claude limit reached'
                : 'Claude usage warning'}
            </Stamp>
          </Tooltip>
        )}
      </div>

      <div style={spacerStyle} />

      {trailing && <div style={rightGroupStyle}>{trailing}</div>}

      <div style={rightGroupStyle}>
        <Tooltip content="Notifications">
          <span style={notificationButtonStyle}>
            <IconButton
              variant="ghost"
              size="small"
              icon={<BellIcon />}
              label="Notifications"
              onClick={onOpenNotifications}
            />
            {unreadNotificationCount > 0 && (
              <span style={notificationBadgeStyle}>
                <Stamp size="small" variant="warning">
                  {unreadNotificationCount}
                </Stamp>
              </span>
            )}
          </span>
        </Tooltip>
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : 'Sync to main'}
        >
          <Button
            variant="ghost"
            size="small"
            icon={<MergeIcon />}
            style={buttonTextStyle}
            disabled={gitActionBusy || gitBranchHygiene === 'clean-on-main'}
            onClick={onSync}
          >
            {syncing ? 'Syncing…' : 'Sync to main'}
          </Button>
        </Tooltip>
        <Tooltip content="Push commits to origin">
          <Button
            variant="ghost"
            size="small"
            icon={<PushIcon />}
            style={buttonTextStyle}
            disabled={gitActionBusy || gitAhead === 0}
            onClick={onPush}
          >
            {pushing ? 'Pushing…' : gitAhead > 0 ? `Push (${gitAhead})` : 'Push'}
          </Button>
        </Tooltip>
        <Tooltip content="Fast-forward the current branch from origin">
          <Button
            variant="ghost"
            size="small"
            icon={<PullIcon />}
            style={buttonTextStyle}
            disabled={gitActionBusy}
            onClick={onPull}
          >
            {pulling ? 'Pulling…' : 'Pull'}
          </Button>
        </Tooltip>
        <Tooltip content="Commit all changes with an auto-suggested message">
          <Button
            variant="ghost"
            size="small"
            icon={<CommitIcon />}
            style={buttonTextStyle}
            disabled={commitInFlight || changedFileCount === 0}
            onClick={onQuickCommit}
          >
            {commitInFlight
              ? 'Committing…'
              : changedFileCount > 0
                ? `Commit (${changedFileCount})`
                : 'Commit'}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
