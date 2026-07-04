import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Button, Pagination } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
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

  // Returning from a closed plan's detail view should scroll its row into view
  // (list-view.tsx targets `.plan-row-highlighted`), but that row only exists once
  // this section is expanded and showing the right page — so drive both from
  // activePlanTitle rather than leaving expansion to a manual toggle.
  useEffect(() => {
    if (!activePlanTitle) return;
    const idx = plans.findIndex((p) => p.title === activePlanTitle);
    if (idx === -1) return;
    setOpen(true);
    setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [activePlanTitle, plans]);

  if (plans.length === 0) return null;
  const totalPages = Math.ceil(plans.length / PAGE_SIZE);
  // Clamp: if the closed list shrinks while a later page is selected, `page` could
  // point past the end and slice to an empty array while Pagination shows the old page.
  const safePage = Math.min(page, Math.max(totalPages, 1));
  const pageStart = (safePage - 1) * PAGE_SIZE;
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
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
