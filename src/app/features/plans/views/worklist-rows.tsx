import { LightbulbIcon, NoteIcon } from '@/app/components/icons';
import type { IdeaGroupRow, NoteRow, PlanSortKey, WorklistRow } from '@/app/features/plans/helpers';
import { groupRowsBySubject } from '@/app/features/plans/helpers';
import { useProjectSubjects } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { DraftPlanButton, ExtendIdeaButton } from '../actions';
import { PlanIdStamp } from '../components';
import { IDEA_STATUS_LABEL, IDEA_STATUS_STAMP } from '../constants';
import { PlanRows } from './plan-rows';

/** Past this many children, done ones collapse behind a "+N done" toggle. */
const DONE_COLLAPSE_THRESHOLD = 5;

interface WorklistRowsProps {
  rows: WorklistRow[];
  /** All plans, not just this group's children — DraftPlanButton's overlap prompt wants the full set. */
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
}

const headerLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: 600,
  opacity: 0.6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const subjectHeaderStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: 700,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: `${space[3]} ${space[1]} 0`,
};

const headerButtonStyle: React.CSSProperties = {
  ...headerLabelStyle,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
};

const SORT_COLUMNS: { key: PlanSortKey; label: string }[] = [
  { key: 'id', label: 'Id' },
  { key: 'title', label: 'Title' },
  { key: 'updated', label: 'Updated' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

const titleButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space[2],
  minWidth: 0,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  fontWeight: 600,
};

const titleTextStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const WorklistRows = ({
  rows,
  plans,
  activePlanTitle,
  onOpenPlan,
  onOpenIdea,
}: WorklistRowsProps) => {
  const [expandedDone, setExpandedDone] = useState<Set<string>>(new Set());
  const { subjects: validSubjects, loading: subjectsLoading } = useProjectSubjects();
  const gridClass = 'plan-rows-grid';
  const sortKey = useAppStore((s) => s.planFilters.sortKey);
  const sortDirection = useAppStore((s) => s.planFilters.sortDirection);
  const setPlanSortKey = useAppStore((s) => s.setPlanSortKey);
  const togglePlanSortDirection = useAppStore((s) => s.togglePlanSortDirection);

  const handleSort = (key: PlanSortKey) => {
    if (key === sortKey) togglePlanSortDirection();
    else setPlanSortKey(key);
  };

  const toggleExpanded = (ideaTitle: string) => {
    setExpandedDone((prev) => {
      const next = new Set(prev);
      if (next.has(ideaTitle)) next.delete(ideaTitle);
      else next.add(ideaTitle);
      return next;
    });
  };

  const renderRow = (row: WorklistRow) => {
    if (row.type === 'plan') {
      return (
        <PlanRows
          key={row.plan.title}
          plans={[row.plan]}
          activePlanTitle={activePlanTitle}
          onOpen={onOpenPlan}
          showHeader={false}
        />
      );
    }
    if (row.type === 'note') {
      return <NoteRowCard key={row.idea.title} row={row} onOpen={onOpenIdea} />;
    }
    return (
      <IdeaGroupRowCard
        key={row.idea.title}
        row={row}
        plans={plans}
        activePlanTitle={activePlanTitle}
        onOpenPlan={onOpenPlan}
        onOpenIdea={onOpenIdea}
        expanded={expandedDone.has(row.idea.title)}
        onToggleExpanded={() => toggleExpanded(row.idea.title)}
      />
    );
  };

  const groups = groupRowsBySubject(rows, subjectsLoading ? undefined : validSubjects);
  const showSubjectHeaders = groups.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div className={gridClass}>
          {SORT_COLUMNS.map(({ key, label }) => {
            const active = key === sortKey;
            return (
              <span
                key={key}
                className={key === 'updated' ? 'plan-rows-cell-updated' : undefined}
                aria-sort={
                  active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                }
              >
                <button type="button" style={headerButtonStyle} onClick={() => handleSort(key)}>
                  {label}
                  {active && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </button>
              </span>
            );
          })}
        </div>
      </Card>
      {showSubjectHeaders
        ? groups.map((group) => (
            <div
              key={group.subject ?? '__no-subject__'}
              style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
            >
              <div style={subjectHeaderStyle}>{group.subject ?? 'No subject'}</div>
              {group.rows.map(renderRow)}
            </div>
          ))
        : rows.map(renderRow)}
    </div>
  );
};

const NoteRowCard = ({
  row,
  onOpen,
}: {
  row: NoteRow;
  onOpen?: (title: string) => void;
}) => {
  const idea = row.idea;
  const status = idea.status ?? 'open';
  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(idea.title) : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(idea.title);
              }
            }
          : undefined
      }
      style={{ cursor: onOpen ? 'pointer' : undefined, borderRadius: 10 }}
    >
      <Card size="small" texture="canvas" className="plan-row-card">
        <div className={'plan-rows-grid'}>
          {idea.id ? <PlanIdStamp id={idea.id} /> : <span />}
          <span style={{ ...titleButtonStyle, cursor: 'inherit' }}>
            <NoteIcon />
            <span style={titleTextStyle}>{idea.title}</span>
          </span>
          <span className="plan-rows-cell-updated text-sm" style={{ opacity: 0.45 }}>
            —
          </span>
          <span className="text-sm" style={{ opacity: 0.3 }}>
            —
          </span>
          <Stamp
            size="small"
            fillColor={IDEA_STATUS_STAMP[status].fill}
            textColor={IDEA_STATUS_STAMP[status].text}
          >
            {IDEA_STATUS_LABEL[status]}
          </Stamp>
        </div>
      </Card>
    </div>
  );
};

interface IdeaGroupRowCardProps {
  row: IdeaGroupRow;
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpenPlan?: (title: string) => void;
  onOpenIdea?: (title: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

const IdeaGroupRowCard = ({
  row,
  plans,
  activePlanTitle,
  onOpenPlan,
  onOpenIdea,
  expanded,
  onToggleExpanded,
}: IdeaGroupRowCardProps) => {
  const idea = row.idea;
  const children = row.children;
  const done = children.filter((p) => p.status === 'done');
  const notDone = children.filter((p) => p.status !== 'done');
  const shouldCollapseDone = children.length > DONE_COLLAPSE_THRESHOLD;
  const visibleChildren = shouldCollapseDone && !expanded ? notDone : children;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="canvas" className="plan-row-card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '76px minmax(0, 1fr) 84px 1fr',
            gap: space[2],
            alignItems: 'center',
          }}
        >
          {idea.id ? <PlanIdStamp id={idea.id} /> : <span />}
          {/* Raw <button>: a chromeless click target wrapping icon + title text,
              not a paper-ui Button. */}
          <button type="button" onClick={() => onOpenIdea?.(idea.title)} style={titleButtonStyle}>
            <LightbulbIcon />
            <span style={titleTextStyle}>{idea.title}</span>
          </button>
          <span className="plan-rows-cell-updated text-sm" style={{ opacity: 0.45 }}>
            —
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: space[2],
            }}
          >
            <span className="text-sm" style={{ opacity: children.length > 0 ? 0.6 : 0.3 }}>
              {children.length > 0 ? `${done.length}/${children.length} plans done` : '—'}
            </span>
            <ExtendIdeaButton idea={idea} compact />
            <DraftPlanButton idea={idea} otherPlans={plans} />
          </div>
        </div>
      </Card>
      {children.length > 0 && (
        <div
          style={{
            marginLeft: space[5],
            paddingLeft: space[3],
            borderLeft: '2px solid rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: space[1],
          }}
        >
          <PlanRows
            plans={visibleChildren}
            activePlanTitle={activePlanTitle}
            onOpen={onOpenPlan}
            showHeader={false}
          />
          {/* Raw <button>: an inline text link, not LinkButton — this one needs a
              muted opacity/font-size rather than LinkButton's fixed amber style. */}
          {shouldCollapseDone && (
            <button
              type="button"
              onClick={onToggleExpanded}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                padding: `${space[1]} 0`,
                opacity: 0.6,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: fontSize.xs,
                font: 'inherit',
              }}
            >
              {expanded ? 'Show less' : `+${done.length} done`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
