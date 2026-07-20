import { PageTitle } from '@/app/components/page-title';
import { fetchRoadmap } from '@/app/services/content/docs-api';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { Roadmap, RoadmapItem } from '@/types/index';
import { Button, Card } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { PromoteRoadmapItemModal } from './promote-roadmap-item-modal';

const horizonHeaderStyle: React.CSSProperties = {
  fontFamily: fontFamily.handwritten,
  fontSize: fontSize.md,
  fontWeight: 600,
  opacity: 0.7,
  lineHeight: 1,
  padding: `${space[2]} ${space[1]} 0`,
};

const RoadmapItemRow = ({
  item,
  onPromote,
}: {
  item: RoadmapItem;
  onPromote: () => void;
}) => (
  <Card size="small" texture="canvas" className="plan-row-card">
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], flex: 1 }}>
        <span style={{ fontWeight: 600 }}>{item.name}</span>
        <span style={{ fontSize: fontSize.sm, opacity: 0.7 }}>{item.description}</span>
      </div>
      <Button type="button" variant="ghost" size="small" onClick={onPromote}>
        Promote to idea
      </Button>
    </div>
  </Card>
);

export const RoadmapPage = () => {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<{ horizonTitle: string; item: RoadmapItem } | null>(
    null,
  );

  useEffect(() => {
    fetchRoadmap()
      .then(setRoadmap)
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
        <p
          style={{
            fontFamily: fontFamily.serif,
            fontSize: fontSize.lg,
            lineHeight: 1.4,
            margin: `${space[2]} 0 0`,
          }}
        >
          {roadmap.goal}
        </p>
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
                onPromote={() => setPromoting({ horizonTitle: horizon.title, item })}
              />
            ))}
          </div>
        ))}
      </div>
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        onClose={() => setPromoting(null)}
        onPromoted={() => fetchRoadmap().then(setRoadmap)}
      />
    </div>
  );
};
