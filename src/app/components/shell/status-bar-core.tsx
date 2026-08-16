import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { AgentTaskStatus, RateLimitSnapshot } from '@/types/index';
import { IconButton, Spinner, Stamp, Tooltip, getTextureStyles } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { BellIcon, GitBranchIcon } from '../icons';

function capacityTooltip(snapshot: RateLimitSnapshot): string {
  const parts = [`Claude usage: ${snapshot.status}`];
  if (snapshot.rateLimitType) parts.push(snapshot.rateLimitType);
  if (snapshot.resetsAt !== undefined)
    parts.push(`resets ${new Date(resetsAtMs(snapshot.resetsAt)).toLocaleTimeString()}`);
  if (snapshot.overage) parts.push('overage on');
  return parts.join(' · ');
}

const barClass =
  'flex items-center gap-3 h-8 px-4 border-b border-black/[0.08] text-xs shrink-0 box-border overflow-x-auto overflow-y-hidden whitespace-nowrap';
const leftGroupClass = 'flex items-center gap-3 shrink-0';
const branchClass = 'flex items-center gap-1';
const mutedClass = 'opacity-50';
const branchNameClass = 'text-[var(--pui-text-primary)]';
const secondaryClass = 'opacity-60';
const spacerClass = 'flex-1';
const rightGroupClass = 'flex items-center gap-2 shrink-0';
const stampTriggerClass = 'bg-transparent border-none p-0 cursor-pointer';
const notificationButtonClass = 'relative inline-flex';
const notificationBadgeClass = 'absolute -top-1 -right-1 pointer-events-none';

export interface StatusBarCoreProps {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  agentActive: boolean;
  activeTaskStatus?: AgentTaskStatus;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  rateLimit?: RateLimitSnapshot | null;
  unreadNotificationCount: number;
  onOpenSetup: () => void;
  onOpenGit: () => void;
  onOpenNotifications: () => void;
  trailing?: ReactNode;
}

// Ambient status only; Sync/Push/Pull/Commit live on `/git`, the Stack panel on task control.
export const StatusBarCore = ({
  gitBranch,
  gitAhead,
  changedFileCount,
  agentActive,
  activeTaskStatus,
  agentNotSignedIn,
  capabilityGapCount,
  rateLimit,
  unreadNotificationCount,
  onOpenSetup,
  onOpenGit,
  onOpenNotifications,
  trailing,
}: StatusBarCoreProps) => {
  return (
    <div className={barClass} style={getTextureStyles('kraft')}>
      <div className={leftGroupClass}>
        <span className={branchClass}>
          <span className={mutedClass}>
            <GitBranchIcon size={12} />
          </span>
          <code className={branchNameClass}>{gitBranch ?? 'no branch'}</code>
        </span>
        {gitAhead > 0 && <span className={secondaryClass}>↑{gitAhead}</span>}
        <span className={secondaryClass}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {agentActive && <Spinner size="small" label={`Agent ${activeTaskStatus}…`} />}
        {agentNotSignedIn && (
          <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button type="button" onClick={onOpenSetup} className={stampTriggerClass}>
              <Stamp size="small" variant="warning">
                Agent not signed in
              </Stamp>
            </button>
          </Tooltip>
        )}
        {capabilityGapCount > 0 && (
          <Tooltip content="Some features are disabled — open Setup to fix">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button type="button" onClick={onOpenSetup} className={stampTriggerClass}>
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

      <div className={spacerClass} />

      {trailing && <div className={rightGroupClass}>{trailing}</div>}

      <div className={rightGroupClass}>
        <Tooltip content="Git">
          <IconButton
            variant="ghost"
            size="small"
            icon={<GitBranchIcon />}
            label="Git"
            onClick={onOpenGit}
          />
        </Tooltip>
        <Tooltip content="Notifications">
          <span className={notificationButtonClass}>
            <IconButton
              variant="ghost"
              size="small"
              icon={<BellIcon />}
              label="Notifications"
              onClick={onOpenNotifications}
            />
            {unreadNotificationCount > 0 && (
              <span className={notificationBadgeClass}>
                <Stamp size="small" variant="warning">
                  {unreadNotificationCount}
                </Stamp>
              </span>
            )}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};
