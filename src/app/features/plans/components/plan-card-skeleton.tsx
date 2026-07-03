import { fontFamily, space } from '@/app/styles/tokens';
import { Card, Skeleton, Stamp } from '@dendelion/paper-ui';

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
      <Skeleton variant="rect" width={60} height={20} />
    </div>

    <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: space[2] }}>
      <Skeleton variant="text" width={90} height={12} />
      <Skeleton variant="rect" width={50} height={18} />
    </div>

    <div style={{ marginTop: space[3] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        <Skeleton variant="rect" width="100%" height={6} style={{ flex: 1 }} />
        <Skeleton variant="text" width={28} height={12} style={{ flexShrink: 0 }} />
      </div>
    </div>
  </Card>
);
