import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { fetchRoadmap } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry, Roadmap, RoadmapItem } from '@/types/index';
import { Button, Card } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { PromoteRoadmapItemModal } from './promote-roadmap-item-modal';

const graduationLabel = (graduated: PlanEntry[]): string | null => {
  if (graduated.length === 0) return null;
  const shipped = graduated.filter((p) => p.status === 'done').length;
  const queued = graduated.filter((p) => p.status !== 'done' && p.status !== 'dropped').length;
  const parts: string[] = [];
  if (queued > 0) parts.push(`${queued} in queue`);
  if (shipped > 0) parts.push(`${shipped} shipped`);
  return parts.length > 0 ? parts.join(', ') : null;
};

const horizonHeaderStyle: React.CSSProperties = {
  fontFamily: fontFamily.handwritten,
  fontSize: fontSize.md,
  fontWeight: 600,
  opacity: 0.7,
  lineHeight: 1,
  padding: `${space[2]} ${space[1]} 0`,
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

const RoadmapItemRow = ({
  item,
  graduated,
  onPromote,
  onPromoteCandidate,
  onViewGraduated,
}: {
  item: RoadmapItem;
  graduated: PlanEntry[];
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onViewGraduated: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasCandidates = item.candidates.length > 0;
  const label = graduationLabel(graduated);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="canvas" className="plan-row-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          {hasCandidates && (
            <button
              type="button"
              aria-expanded={expanded}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{item.name}</span>
            <span style={{ fontSize: fontSize.sm, opacity: 0.7 }}>{item.description}</span>
            {label && (
              <button
                type="button"
                onClick={onViewGraduated}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: fontSize['2xs'],
                  opacity: 0.65,
                  textDecoration: 'underline',
                }}
              >
                {label}
              </button>
            )}
          </div>
          <Button type="button" variant="ghost" size="small" onClick={onPromote}>
            Promote to idea
          </Button>
        </div>
      </Card>
      {hasCandidates && expanded && (
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
        </div>
      )}
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

  return (
    <div>
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
          <Markdown>{roadmap.goal}</Markdown>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
        {roadmap.horizons.map((horizon) => (
          <div
            key={horizon.title}
            style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
          >
            <div style={horizonHeaderStyle}>{horizon.title}</div>
            {horizon.items.map((item) => (
              <RoadmapItemRow
                key={item.name}
                item={item}
                graduated={plans?.entries.filter((p) => p.subject === item.name) ?? []}
                onPromote={() => setPromoting({ horizonTitle: horizon.title, item })}
                onPromoteCandidate={(candidateName) =>
                  setPromoting({ horizonTitle: horizon.title, item, candidateName })
                }
                onViewGraduated={() => navigate({ to: '/', search: { subject: item.name } })}
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
