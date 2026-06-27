import { space } from '@/app/styles/tokens';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { CheckIcon, Icon, LightbulbIcon, Stamp, Table } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_ACCENT } from '../constants';
import { DraftPlanButton } from './draft-plan-button';

interface IdeasBoardProps {
  ideas: IdeaEntry[];
  plans: PlanEntry[];
  onOpenIdea?: (title: string) => void;
  onOpenPlan?: (title: string) => void;
}

const COLUMNS = [
  {
    key: 'planned',
    label: 'Planned',
    accent: STATUS_ACCENT.planned,
    icon: <LightbulbIcon />,
    iconFill: undefined as string | undefined,
    filter: (i: IdeaEntry) => !i.status || i.status === 'planned',
  },
  {
    key: 'done',
    label: 'Done',
    accent: STATUS_ACCENT.done,
    icon: <CheckIcon size={14} />,
    iconFill: 'rgba(143, 185, 150, 0.35)',
    filter: (i: IdeaEntry) => i.status === 'done',
  },
] as const;

export const IdeasBoard = ({ ideas, plans, onOpenIdea, onOpenPlan }: IdeasBoardProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const MAX_DONE = 4;

  if (ideas.length === 0) return null;

  const linkedPlans = (ideaId: string) => plans.filter((p) => p.idea === ideaId);

  return (
    <Table
      board={COLUMNS.map(({ key, label, accent, icon, iconFill, filter }) => {
        const filtered = ideas.filter(filter);
        const isDone = key === 'done';
        const overflowCount = isDone ? filtered.length - MAX_DONE : 0;
        const showOverflowLink = overflowCount > 0 && !showAllDone;
        const items: (IdeaEntry | { __overflow: true; count: number })[] = showOverflowLink
          ? [...filtered.slice(0, MAX_DONE), { __overflow: true, count: overflowCount }]
          : filtered;
        return {
          key,
          label: isDone ? `${label} (${filtered.length})` : label,
          accent,
          items,
          getKey: (idea: IdeaEntry | { __overflow: true; count: number }) =>
            '__overflow' in idea ? '__overflow' : idea.title,
          renderItem: (idea: IdeaEntry | { __overflow: true; count: number }) => {
            if ('__overflow' in idea) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: `${space[2]} 0`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowAllDone(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      fontSize: '0.8rem',
                      opacity: 0.5,
                      textDecoration: 'underline',
                    }}
                  >
                    {idea.count} more idea{idea.count === 1 ? '' : 's'}
                  </button>
                </div>
              );
            }
            const isExpanded = expanded === idea.title;
            const links = idea.id ? linkedPlans(idea.id) : [];
            const hasLinks = links.length > 0;
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                  <button
                    type="button"
                    onClick={() => onOpenIdea?.(idea.title)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: space[2],
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    <Icon icon={icon} size="small" fillColor={iconFill} />
                    <span className="text-sm" style={{ fontWeight: 500, lineHeight: 1.3 }}>
                      {idea.title}
                    </span>
                  </button>
                  {hasLinks && (
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Hide linked plans' : 'Show linked plans'}
                      onClick={() => setExpanded(isExpanded ? null : idea.title)}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        opacity: 0.45,
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        font: 'inherit',
                      }}
                    >
                      {isExpanded ? '▾' : '▸'} {links.length}
                    </button>
                  )}
                  {!hasLinks && idea.id && (
                    <div style={{ flexShrink: 0 }}>
                      <DraftPlanButton idea={idea} otherPlans={plans} />
                    </div>
                  )}
                </div>
                {isExpanded && hasLinks && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: space[1],
                      marginTop: space[2],
                    }}
                  >
                    {links.map((p) => (
                      <button
                        type="button"
                        key={p.title}
                        onClick={() => onOpenPlan?.(p.title)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
                          {p.id}
                        </Stamp>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        };
      })}
    />
  );
};
