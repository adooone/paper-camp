import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { AgentTaskStatus, RateLimitSnapshot } from '@/types/index';
import {
  IconButton,
  Menu,
  type MenuEntry,
  Spinner,
  Stamp,
  Tooltip,
  getTextureStyles,
} from '@dendelion/paper-ui';
import type { ReactNode, RefObject } from 'react';
import { BellIcon, ChatIcon, GitBranchIcon, MoreIcon } from '../icons';

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
const spacerClass = 'flex-1';
const rightGroupClass = 'flex items-center gap-2 shrink-0';
const stampTriggerClass = 'bg-transparent border-none p-0 cursor-pointer';
const notificationButtonClass = 'relative inline-flex h-[32px] items-center';
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
  /** Measured by `useStatusBarOverflow` in the wrapper; absent means nothing hides. */
  overflow?: {
    hidden: ReadonlySet<string>;
    barRef: RefObject<HTMLDivElement>;
    registerFixed: (key: string) => (el: HTMLElement | null) => void;
    registerItem: (key: string) => (el: HTMLElement | null) => void;
  };
}

/** The foldable items a given set of props renders, lowest priority first to hide. */
export function statusBarOverflowCandidates(
  props: Pick<
    StatusBarCoreProps,
    | 'trailing'
    | 'trailingEntry'
    | 'gitAhead'
    | 'rateLimit'
    | 'capabilityGapCount'
    | 'agentNotSignedIn'
  >,
): { key: string; priority: number }[] {
  const keys: { key: string; priority: number }[] = [];
  if (props.trailing && props.trailingEntry) keys.push({ key: 'refresh', priority: 1 });
  keys.push({ key: 'git', priority: 2 });
  if (props.gitAhead > 0) keys.push({ key: 'ahead', priority: 3 });
  if (props.rateLimit && capacityLevel(props.rateLimit.status) !== 'allowed') {
    keys.push({ key: 'capacity', priority: 4 });
  }
  if (props.capabilityGapCount > 0) keys.push({ key: 'setup', priority: 5 });
  if (props.agentNotSignedIn) keys.push({ key: 'signin', priority: 6 });
  return keys;
}

interface BarItem {
  key: string;
  priority: number;
  node: ReactNode;
  entry: MenuEntry;
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
  overflow,
}: StatusBarCoreProps) => {
  const capacity = rateLimit ? capacityLevel(rateLimit.status) : 'allowed';
  const capacityLabel = capacity === 'rejected' ? 'Claude limit reached' : 'Claude usage warning';

  const items: BarItem[] = [];
  if (trailing && trailingEntry) {
    items.push({ key: 'refresh', priority: 1, node: trailing, entry: trailingEntry });
  }
  items.push({
    key: 'git',
    priority: 2,
    node: (
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
    entry: { id: 'git', label: 'Git', icon: <GitBranchIcon size={16} />, onSelect: onOpenGit },
  });
  if (gitAhead > 0) {
    items.push({
      key: 'ahead',
      priority: 3,
      node: <span className={secondaryClass}>↑{gitAhead}</span>,
      entry: { id: 'ahead', label: `↑${gitAhead} ahead of origin`, onSelect: onOpenGit },
    });
  }
  if (rateLimit && capacity !== 'allowed') {
    items.push({
      key: 'capacity',
      priority: 4,
      node: (
        <Tooltip content={capacityTooltip(rateLimit)}>
          <Stamp size="small" variant={capacity === 'rejected' ? 'error' : 'warning'}>
            {capacityLabel}
          </Stamp>
        </Tooltip>
      ),
      entry: { id: 'capacity', label: capacityTooltip(rateLimit), onSelect: () => {} },
    });
  }
  if (capabilityGapCount > 0) {
    items.push({
      key: 'setup',
      priority: 5,
      node: (
        <Tooltip content="Some features are disabled — open Setup to fix">
          {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
          <button type="button" onClick={onOpenSetup} className={stampTriggerClass}>
            <Stamp size="small" variant="warning">
              Setup ({capabilityGapCount})
            </Stamp>
          </button>
        </Tooltip>
      ),
      entry: { id: 'setup', label: `Setup (${capabilityGapCount})`, onSelect: onOpenSetup },
    });
  }
  if (agentNotSignedIn) {
    items.push({
      key: 'signin',
      priority: 6,
      node: (
        <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
          {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
          <button type="button" onClick={onOpenSetup} className={stampTriggerClass}>
            <Stamp size="small" variant="warning">
              Agent not signed in
            </Stamp>
          </button>
        </Tooltip>
      ),
      entry: { id: 'signin', label: 'Agent not signed in', onSelect: onOpenSetup },
    });
  }

  const hidden = overflow?.hidden ?? new Set<string>();
  const barRef = overflow?.barRef;
  const noRef = () => undefined;
  const registerFixed = overflow?.registerFixed ?? (() => noRef);
  const registerItem = overflow?.registerItem ?? (() => noRef);
  const visible = (key: string) => !hidden.has(key);
  const leftItems = items.filter((item) => !['refresh', 'git'].includes(item.key));
  const rightItems = items.filter((item) => ['refresh', 'git'].includes(item.key));
  const menuEntries = items.filter((item) => hidden.has(item.key)).map((item) => item.entry);

  return (
    <div ref={barRef} className={barClass} style={getTextureStyles('kraft')}>
      <div className={leftGroupClass}>
        <span ref={registerFixed('branch')} className={branchClass}>
          <span className={mutedClass}>
            <GitBranchIcon size={12} />
          </span>
          <code className={branchNameClass} title={gitBranch ?? undefined}>
            {gitBranch ?? 'no branch'}
          </code>
        </span>
        <span ref={registerFixed('changed')} className={secondaryClass}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {failingCheckCount > 0 && (
          <Tooltip
            content={`${failingCheckCount} check${failingCheckCount === 1 ? '' : 's'} failing — open Git`}
          >
            <span ref={registerFixed('failing')}>
              {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
              <button type="button" onClick={onOpenGit} className={stampTriggerClass}>
                <Stamp size="small" variant="error">
                  {failingCheckCount} failing
                </Stamp>
              </button>
            </span>
          </Tooltip>
        )}
        {agentActive && (
          <span ref={registerFixed('spinner')}>
            <Spinner size="small" label={`Agent ${activeTaskStatus}…`} />
          </span>
        )}
        {leftItems.map((item) =>
          visible(item.key) ? (
            <span key={item.key} ref={registerItem(item.key)} className="inline-flex items-center">
              {item.node}
            </span>
          ) : null,
        )}
      </div>

      <div className={spacerClass} />

      <div className={rightGroupClass}>
        {rightItems.map((item) =>
          visible(item.key) ? (
            <span key={item.key} ref={registerItem(item.key)} className="inline-flex items-center">
              {item.node}
            </span>
          ) : null,
        )}
        {menuEntries.length > 0 && (
          <Menu
            align="end"
            trigger={
              <IconButton
                variant="ghost"
                size="small"
                icon={<MoreIcon size={16} />}
                label="More status"
              />
            }
            items={menuEntries}
          />
        )}
        <Tooltip content="Chat">
          <span ref={registerFixed('chat')} className={notificationButtonClass}>
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
          <span ref={registerFixed('bell')} className={notificationButtonClass}>
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
