import { surface } from '@/app/styles/tokens';
import { Button, Card } from '@dendelion/paper-ui';
import type { ContinueTarget } from '../helpers/continue-target';

export interface ContinueStripProps {
  target: ContinueTarget;
  onOpen: () => void;
}

export const ContinueStrip = ({ target, onOpen }: ContinueStripProps) => (
  // Card puts `className` on its border layer, so the row lives in a child of its own.
  <Card size="small" texture={surface.card}>
    <div className="flex items-center justify-between gap-3 text-left">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-handwritten text-2xs uppercase opacity-50">Continue</span>
        <span className="truncate font-handwritten text-base">{target.row.slug}</span>
        {target.row.stamp.kind === 'running' && (
          <span className="truncate text-2xs opacity-60">
            running{target.row.stamp.ideaId ? ` · ${target.row.stamp.ideaId}` : ''}
          </span>
        )}
      </div>
      <Button size="small" variant="primary" onClick={onOpen}>
        Open
      </Button>
    </div>
  </Card>
);
