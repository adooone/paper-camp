import { surface } from '@/app/styles/tokens';
import { Card } from '@dendelion/paper-ui';

export const DESK_SERVICE_GRID_CLASS =
  'grid grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_80px_minmax(140px,1fr)_32px] gap-3 items-center';

export const DeskServiceRowHeader = () => (
  <Card size="small" texture={surface.card} className="plan-row-card">
    <div className="overflow-x-auto">
      <div className={DESK_SERVICE_GRID_CLASS}>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Name</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Command</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Port</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Healthcheck</span>
        <span />
      </div>
    </div>
  </Card>
);
