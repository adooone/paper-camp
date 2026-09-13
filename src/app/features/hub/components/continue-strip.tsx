import { surface } from '@/app/styles/tokens';
import { Button, Card } from '@dendelion/paper-ui';
import type { ContinueTarget } from '../helpers/continue-target';

export interface ContinueStripProps {
  target: ContinueTarget;
  onOpen: () => void;
}

export const ContinueStrip = ({ target, onOpen }: ContinueStripProps) => (
  <Card
    size="small"
    texture={surface.card}
    className="flex items-center justify-between gap-2 text-left"
  >
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="m-0 text-xs uppercase opacity-60">Continue</p>
      <p className="m-0 break-words font-handwritten text-lg">{target.row.slug}</p>
      {target.row.stamp.kind === 'running' && (
        <p className="m-0 text-sm opacity-70">
          Running{target.row.stamp.ideaId ? ` · ${target.row.stamp.ideaId}` : ''}
        </p>
      )}
    </div>
    <Button size="small" variant="primary" onClick={onOpen}>
      Open
    </Button>
  </Card>
);
