import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Button, Pagination } from '@dendelion/paper-ui';
import { useState } from 'react';
import { PlanRows } from './plan-rows';

const PAGE_SIZE = 10;

interface ClosedSectionProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
}

export const ClosedSection = ({ plans, activePlanTitle, onOpen }: ClosedSectionProps) => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  if (plans.length === 0) return null;
  const totalPages = Math.ceil(plans.length / PAGE_SIZE);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pagePlans = plans.slice(pageStart, pageStart + PAGE_SIZE);
  return (
    <div style={{ marginTop: space[8] }}>
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={() => {
          setOpen((v) => !v);
          setPage(1);
        }}
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
        <div style={{ marginTop: '0.65rem' }}>
          <PlanRows plans={pagePlans} activePlanTitle={activePlanTitle} onOpen={onOpen} />
          {totalPages > 1 && (
            <div style={{ marginTop: space[3], display: 'flex', justifyContent: 'center' }}>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
