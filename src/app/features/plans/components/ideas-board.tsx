import { space } from '@/app/styles/tokens';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { CheckIcon, Icon, LightbulbIcon, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_COLOR } from '../constants';

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
    accent: STATUS_COLOR.planned,
    filter: (i: IdeaEntry) => !i.status || i.status === 'planned',
  },
  {
    key: 'done',
    label: 'Done',
    accent: STATUS_COLOR.done,
    filter: (i: IdeaEntry) => i.status === 'done',
  },
] as const;

export const IdeasBoard = ({ ideas, plans, onOpenIdea, onOpenPlan }: IdeasBoardProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (ideas.length === 0) return null;

  const linkedPlans = (ideaId: string) => plans.filter((p) => p.idea === ideaId);

  return (
    <div
      style={{
        display: 'flex',
        gap: space[3],
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      {COLUMNS.map(({ key, label, accent, filter }) => {
        const columnIdeas = ideas.filter(filter);
        return (
          <div
            key={key}
            style={{
              width: 280,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(0,0,0,0.025)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: `0.65rem ${space[3]}`,
                borderBottom: '2px solid',
                borderBottomColor: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                className="text-xs"
                style={{
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: 0.65,
                }}
              >
                {label}
              </span>
              <span
                className="text-xs"
                style={{
                  background: accent,
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: columnIdeas.length === 0 ? 0.3 : 0.85,
                }}
              >
                {columnIdeas.length}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: space[2],
                minHeight: 80,
              }}
            >
              {columnIdeas.length === 0 ? (
                <div
                  className="text-sm"
                  style={{
                    textAlign: 'center',
                    opacity: 0.25,
                    marginTop: space[2],
                    fontStyle: 'italic',
                  }}
                >
                  empty
                </div>
              ) : (
                columnIdeas.map((idea) => {
                  const isExpanded = expanded === idea.title;
                  const links = idea.id ? linkedPlans(idea.id) : [];
                  const hasLinks = links.length > 0;
                  return (
                    <div key={idea.title}>
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(0,0,0,0.1)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenIdea?.(idea.title)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            background: 'none',
                            border: 'none',
                            padding: `0.5rem ${space[3]}`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: space[2],
                            textAlign: 'left',
                            font: 'inherit',
                            color: 'inherit',
                          }}
                        >
                          <Icon
                            icon={key === 'done' ? <CheckIcon size={14} /> : <LightbulbIcon />}
                            size="small"
                          />
                          <span
                            className="text-sm"
                            style={{
                              fontWeight: 500,
                              lineHeight: 1.3,
                            }}
                          >
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
                              padding: `0.5rem ${space[3]}`,
                              opacity: 0.45,
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              font: 'inherit',
                            }}
                          >
                            {isExpanded ? '▾' : '▸'} {links.length}
                          </button>
                        )}
                      </div>
                      {isExpanded && hasLinks && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: space[1],
                            padding: `${space[1]} ${space[3]} ${space[2]}`,
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
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
