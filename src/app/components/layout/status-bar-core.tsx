import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { AgentTaskStatus, RateLimitSnapshot } from '@/types/index';
import {
  BellIcon,
  ChatIcon,
  GitBranchIcon,
  IconButton,
  type MenuEntry,
  OverflowToolbar,
  type OverflowToolbarItem,
  Spinner,
  Stamp,
  Tooltip,
  getTextureStyles,
} from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

function capacityTooltip(snapshot: RateLimitSnapshot): string {
  const parts = [`Claude usage: ${snapshot.status}`];
  if (snapshot.rateLimitType) parts.push(snapshot.rateLimitType);
  if (snapshot.resetsAt !== undefined)
    parts.push(`resets ${new Date(resetsAtMs(snapshot.resetsAt)).toLocaleTimeString()}`);
  if (snapshot.overage) parts.push('overage on');
  return parts.join(' · ');
}

const barClass =
  'flex items-center gap-3 h-[32px] px-4 border-b border-black/[0.08] text-xs shrink-0 box-border overflow-hidden whitespace-nowrap';
const leftGroupClass = 'flex min-w-0 items-center gap-3';
const branchClass = 'flex items-center gap-1';
const mutedClass = 'opacity-50';
const branchNameClass = 'min-w-0 max-w-[40vw] truncate text-[var(--pui-text-primary)]';
const secondaryClass = 'opacity-60';
const rightGroupClass = 'flex min-w-0 items-center gap-2';
const notificationButtonClass = 'relative inline-flex h-[32px] shrink-0 items-center';
// Raw badge: paper-ui's Stamp is a translucent wash, unreadable over the bell's strokes.
const notificationBadgeClass =
  'pointer-events-none absolute top-0 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-watercolor-amber-dark px-1 font-handwritten text-xs font-semibold leading-none text-paper-50';

export interface StatusBarCoreProps {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  failingCheckCount?: number;
  agentActive: boolean;
  activeTaskStatus?: AgentTaskStatus;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  rateLimit?: RateLimitSnapshot | null;
  unreadNotificationCount: number;
  unansweredChatQuestionCount: number;
  onOpenSetup: () => void;
  onOpenGit: () => void;
  onOpenNotifications: () => void;
  onOpenChat: () => void;
  trailing?: ReactNode;
  /** How `trailing` appears once it has been folded into the "more" menu. */
  trailingEntry?: MenuEntry;
}

// Ambient status only. Branch, change count, spinner, chat, and bell always show; the
// rest folds into a "more" menu when the bar runs out of width, lowest priority first.
export const StatusBarCore = ({
  gitBranch,
  gitAhead,
  changedFileCount,
  failingCheckCount = 0,
  agentActive,
  activeTaskStatus,
  agentNotSignedIn,
  capabilityGapCount,
  rateLimit,
  unreadNotificationCount,
  unansweredChatQuestionCount,
  onOpenSetup,
  onOpenGit,
  onOpenNotifications,
  onOpenChat,
  trailing,
  trailingEntry,
}: StatusBarCoreProps) => {
  const capacity = rateLimit ? capacityLevel(rateLimit.status) : 'allowed';
  const capacityLabel = capacity === 'rejected' ? 'Claude limit reached' : 'Claude usage warning';

  const items: OverflowToolbarItem[] = [];
  if (trailing && trailingEntry && 'label' in trailingEntry) {
    items.push({ ...trailingEntry, priority: 1, content: trailing });
  }
  items.push({
    id: 'git',
    priority: 2,
    label: 'Git',
    icon: <GitBranchIcon size={16} />,
    onSelect: onOpenGit,
    content: (
      <Tooltip content="Git">
        <IconButton
          variant="ghost"
          size="small"
          icon={<GitBranchIcon />}
          label="Git"
          onClick={onOpenGit}
        />
      </Tooltip>
    ),
  });
  if (gitAhead > 0) {
    items.push({
      id: 'ahead',
      priority: 3,
      label: `↑${gitAhead} ahead of origin`,
      onSelect: onOpenGit,
      content: <span className={secondaryClass}>↑{gitAhead}</span>,
    });
  }
  if (rateLimit && capacity !== 'allowed') {
    items.push({
      id: 'capacity',
      priority: 4,
      label: capacityTooltip(rateLimit),
      content: (
        <Tooltip content={capacityTooltip(rateLimit)}>
          <Stamp size="small" variant={capacity === 'rejected' ? 'error' : 'warning'}>
            {capacityLabel}
          </Stamp>
        </Tooltip>
      ),
    });
  }
  if (capabilityGapCount > 0) {
    items.push({
      id: 'setup',
      priority: 5,
      label: `Setup (${capabilityGapCount})`,
      onSelect: onOpenSetup,
      content: (
        <Tooltip content="Some features are disabled — open Setup to fix">
          <Stamp size="small" variant="warning" onClick={onOpenSetup}>
            Setup ({capabilityGapCount})
          </Stamp>
        </Tooltip>
      ),
    });
  }
  if (agentNotSignedIn) {
    items.push({
      id: 'signin',
      priority: 6,
      label: 'Agent not signed in',
      onSelect: onOpenSetup,
      content: (
        <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
          <Stamp size="small" variant="warning" onClick={onOpenSetup}>
            Agent not signed in
          </Stamp>
        </Tooltip>
      ),
    });
  }

  return (
    <div className={barClass} style={getTextureStyles('kraft')}>
      <div className={leftGroupClass}>
        <span className={branchClass}>
          <span className={mutedClass}>
            <GitBranchIcon size={12} />
          </span>
          <code className={branchNameClass} title={gitBranch ?? undefined}>
            {gitBranch ?? 'no branch'}
          </code>
        </span>
        <span className={secondaryClass}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {failingCheckCount > 0 && (
          <Tooltip
            content={`${failingCheckCount} check${failingCheckCount === 1 ? '' : 's'} failing — open Git`}
          >
            <Stamp size="small" variant="error" onClick={onOpenGit}>
              {failingCheckCount} failing
            </Stamp>
          </Tooltip>
        )}
        {agentActive && <Spinner size="small" label={`Agent ${activeTaskStatus}…`} />}
      </div>

      <div className={rightGroupClass}>
        <OverflowToolbar items={items} className="min-w-0 flex-1 justify-end" />
        <Tooltip content="Chat">
          <span className={notificationButtonClass}>
            <IconButton
              variant="ghost"
              size="small"
              icon={<ChatIcon />}
              label="Chat"
              onClick={onOpenChat}
            />
            {unansweredChatQuestionCount > 0 && (
              <span
                className={notificationBadgeClass}
                aria-label={`${unansweredChatQuestionCount} unanswered in chat`}
              >
                {unansweredChatQuestionCount}
              </span>
            )}
          </span>
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
              <span
                className={notificationBadgeClass}
                aria-label={`${unreadNotificationCount} unread notifications`}
              >
                {unreadNotificationCount}
              </span>
            )}
          </span>
        </Tooltip>
      </div>
    </div>
  );
};
