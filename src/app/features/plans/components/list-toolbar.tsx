import { space } from '@/app/styles/tokens';
import { Card } from '@dendelion/paper-ui';
import { AuditAllButton } from './audit-all-button';
import { ViewToggle } from './view-toggle';

interface ListToolbarProps {
  view: 'list' | 'board';
  onChangeView: (v: 'list' | 'board') => void;
}

/**
 * Header area for the plans list/board: a kraft Card matching plan-rows.tsx's
 * own header styling, sitting directly above whichever view is active so the
 * actions read as part of the list rather than the page's title bar.
 */
export const ListToolbar = ({ view, onChangeView }: ListToolbarProps) => {
  return (
    <div style={{ marginBottom: space[4] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: space[2],
          }}
        >
          <AuditAllButton />
          <ViewToggle view={view} onChange={onChangeView} />
        </div>
      </Card>
    </div>
  );
};
