import type { PlanEntry } from '@/types/index';
import { Button } from '@dendelion/paper-ui';
import { useState } from 'react';
import { PlanCard } from './plan-card';

interface ClosedSectionProps {
  plans: PlanEntry[];
}

export const ClosedSection = ({ plans }: ClosedSectionProps) => {
  const [open, setOpen] = useState(false);
  if (plans.length === 0) return null;
  return (
    <div style={{ marginTop: '2rem' }}>
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}
      >
        <span
          className="text-xs"
          style={{
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.35,
          }}
        >
          Closed
        </span>
        <span className="text-xs" style={{ opacity: 0.3 }}>
          {plans.length}
        </span>
        <span className="text-xs" style={{ opacity: 0.3 }}>
          {open ? '▴' : '▾'}
        </span>
      </Button>
      {open && (
        <div
          style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}
        >
          {plans.map((p) => (
            <PlanCard key={p.title} plan={p} />
          ))}
        </div>
      )}
    </div>
  );
};
