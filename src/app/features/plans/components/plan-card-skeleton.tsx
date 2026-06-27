import { fontFamily, space } from '@/app/styles/tokens';
import { Card, Stamp } from '@dendelion/paper-ui';

interface PlanCardSkeletonProps {
  ideaId: string;
}

export const PlanCardSkeleton = ({ ideaId }: PlanCardSkeletonProps) => (
  <Card texture="kraft">
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space[3],
      }}
    >
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.3rem',
          margin: 0,
          lineHeight: 1.3,
          display: 'flex',
          alignItems: 'center',
          gap: space[2],
        }}
      >
        <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
          {ideaId}
        </Stamp>
        <span style={{ opacity: 0.55 }}>Creating a plan…</span>
      </h2>
      <div className="paper-camp-skeleton" style={{ width: 60, height: 20, opacity: 0.18 }} />
    </div>

    <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: space[2] }}>
      <div className="paper-camp-skeleton" style={{ width: 90, height: 12, opacity: 0.18 }} />
      <div
        className="paper-camp-skeleton"
        style={{ width: 50, height: 18, borderRadius: 999, opacity: 0.18 }}
      />
    </div>

    <div style={{ marginTop: space[3] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        <div className="paper-camp-skeleton" style={{ flex: 1, height: 6, opacity: 0.18 }} />
        <div
          className="paper-camp-skeleton"
          style={{ width: 28, height: 12, flexShrink: 0, opacity: 0.18 }}
        />
      </div>
    </div>
  </Card>
);
