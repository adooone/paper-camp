import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { fetchRoadmap } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry, Roadmap, RoadmapItem } from '@/types/index';
import { Button, Card, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { PromoteRoadmapItemModal } from './promote-roadmap-item-modal';

const graduationCounts = (graduated: PlanEntry[]) => ({
  shipped: graduated.filter((p) => p.status === 'done').length,
  queued: graduated.filter((p) => p.status !== 'done' && p.status !== 'dropped').length,
});

const horizonHeaderStyle: React.CSSProperties = {
  fontFamily: fontFamily.handwritten,
  fontSize: fontSize.md,
  fontWeight: 600,
  opacity: 0.7,
  lineHeight: 1,
  padding: `${space[2]} ${space[1]} 0`,
};

const horizonPulseStyle: React.CSSProperties = {
  fontFamily: fontFamily.body,
  fontSize: fontSize['2xs'],
  fontWeight: 400,
  opacity: 0.5,
  padding: `0 ${space[1]}`,
};

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CandidateRow = ({
  name,
  onPromote,
}: {
  name: string;
  onPromote: () => void;
}) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
      <span style={{ flex: 1 }}>{name}</span>
      <Button type="button" variant="ghost" size="small" onClick={onPromote}>
        Promote to idea
      </Button>
    </div>
  </Card>
);

const GraduatedRow = ({ plan, onOpen }: { plan: PlanEntry; onOpen: () => void }) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        width: '100%',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {plan.title}
      </span>
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[plan.status].fill}
        textColor={STATUS_STAMP[plan.status].text}
      >
        {STATUS_LABEL[plan.status]}
      </Stamp>
    </button>
  </Card>
);

const RoadmapItemRow = ({
  item,
  graduated,
  onPromote,
  onPromoteCandidate,
  onViewGraduated,
  onOpenGraduated,
}: {
  item: RoadmapItem;
  graduated: PlanEntry[];
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onViewGraduated: () => void;
  onOpenGraduated: (title: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasCandidates = item.candidates.length > 0;
  const hasGraduated = graduated.length > 0;
  const canExpand = hasCandidates || hasGraduated;
  const { shipped, queued } = graduationCounts(graduated);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="canvas" className="plan-row-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            {canExpand && (
              // Raw <button>: icon-only toggle, paper-ui Button doesn't offer this compact chrome.
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse item' : 'Expand item'}
                onClick={() => setExpanded((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.5,
                  padding: 0,
                  transform: expanded ? 'rotate(90deg)' : undefined,
                }}
              >
                <ChevronRightIcon />
              </button>
            )}
            <span style={{ fontWeight: 600, flex: 1 }}>{item.name}</span>
            <Button type="button" variant="ghost" size="small" onClick={onPromote}>
              Promote to idea
            </Button>
          </div>
          <span
            className={expanded ? undefined : 'roadmap-item-desc'}
            style={{ fontSize: fontSize.sm, opacity: 0.7 }}
          >
            {item.description}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
            {(queued > 0 || shipped > 0) && (
              <button
                type="button"
                onClick={onViewGraduated}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[1],
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {queued > 0 && (
                  <Stamp
                    size="small"
                    fillColor={STATUS_STAMP.planned.fill}
                    textColor={STATUS_STAMP.planned.text}
                  >
                    {queued} in queue
                  </Stamp>
                )}
                {shipped > 0 && (
                  <Stamp
                    size="small"
                    fillColor={STATUS_STAMP.done.fill}
                    textColor={STATUS_STAMP.done.text}
                  >
                    {shipped} shipped
                  </Stamp>
                )}
              </button>
            )}
            {hasCandidates && (
              <Stamp size="small" fillColor="rgba(0, 0, 0, 0.06)" textColor="rgba(0, 0, 0, 0.55)">
                {item.candidates.length} candidate{item.candidates.length === 1 ? '' : 's'}
              </Stamp>
            )}
          </div>
        </div>
      </Card>
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space[1],
            paddingLeft: space[6],
          }}
        >
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
            />
          ))}
          {graduated.map((plan) => (
            <GraduatedRow key={plan.title} plan={plan} onOpen={() => onOpenGraduated(plan.title)} />
          ))}
        </div>
      )}
    </div>
  );
};

const GoalBanner = ({ goal }: { goal: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [firstParagraph, ...restParagraphs] = goal.split(/\n{2,}/);
  const hasMore = restParagraphs.length > 0;

  return (
    <div
      style={{
        marginBottom: space[6],
        paddingBottom: space[4],
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.handwritten,
          fontSize: fontSize.xs,
          fontWeight: 600,
          opacity: 0.55,
        }}
      >
        The goal
      </span>
      <div
        style={{
          fontFamily: fontFamily.serif,
          fontSize: fontSize.lg,
          lineHeight: 1.4,
          marginTop: space[2],
        }}
      >
        <div className={expanded ? undefined : 'roadmap-goal-line-clamp'}>
          <Markdown>{firstParagraph}</Markdown>
        </div>
        {expanded && hasMore && <Markdown>{restParagraphs.join('\n\n')}</Markdown>}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: space[2],
            cursor: 'pointer',
            fontSize: fontSize['2xs'],
            opacity: 0.65,
            textDecoration: 'underline',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

const HorizonPulse = ({
  items,
  graduatedByItem,
}: { items: RoadmapItem[]; graduatedByItem: (item: RoadmapItem) => PlanEntry[] }) => {
  const graduated = items.filter((item) => graduatedByItem(item).length > 0).length;
  const charted = items.length - graduated;
  return (
    <div style={horizonPulseStyle}>
      {graduated} graduated · {charted} charted
    </div>
  );
};

export const RoadmapPage = () => {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [promoting, setPromoting] = useState<{
    horizonTitle: string;
    item: RoadmapItem;
    candidateName?: string;
  } | null>(null);
  const plans = useAppStore((s) => s.plans);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRoadmap()
      .then(setRoadmap)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p style={{ opacity: 0.5 }}>
          Couldn't load the roadmap — the server may need a restart to pick up new routes.
        </p>
      </div>
    );
  }

  if (!roadmap || roadmap.horizons.length === 0) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p style={{ opacity: 0.5 }}>No `ROADMAP.md` found at the project root.</p>
      </div>
    );
  }

  const graduatedByItem = (item: RoadmapItem) =>
    plans?.entries.filter((p) => p.subject === item.name) ?? [];

  return (
    <div>
      <GoalBanner goal={roadmap.goal} />
      <div className="roadmap-horizons-grid">
        {roadmap.horizons.map((horizon) => (
          <div
            key={horizon.title}
            style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: space[2] }}>
              <div style={horizonHeaderStyle}>{horizon.title}</div>
              <HorizonPulse items={horizon.items} graduatedByItem={graduatedByItem} />
            </div>
            {horizon.items.map((item) => (
              <RoadmapItemRow
                key={item.name}
                item={item}
                graduated={graduatedByItem(item)}
                onPromote={() => setPromoting({ horizonTitle: horizon.title, item })}
                onPromoteCandidate={(candidateName) =>
                  setPromoting({ horizonTitle: horizon.title, item, candidateName })
                }
                onViewGraduated={() => navigate({ to: '/', search: { subject: item.name } })}
                onOpenGraduated={(title) =>
                  navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(title) } })
                }
              />
            ))}
          </div>
        ))}
      </div>
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        candidateName={promoting?.candidateName}
        onClose={() => setPromoting(null)}
        onPromoted={() => fetchRoadmap().then(setRoadmap)}
      />
    </div>
  );
};
