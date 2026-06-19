import type { PlanEntry, PlanStatus } from '@/types/index';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  status: PlanStatus;
  label: string;
  accent: string;
  plans: PlanEntry[];
}

export const KanbanColumn = ({ status, label, accent, plans }: KanbanColumnProps) => {
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.025)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '0.65rem 0.75rem',
          borderBottom: '2px solid',
          borderBottomColor: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          className="text-xs"
          style={{
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.65,
          }}
        >
          {label}
        </span>
        <span
          className="text-xs"
          style={{
            background: accent,
            color: '#fff',
            borderRadius: '50%',
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: plans.length === 0 ? 0.3 : 0.85,
          }}
        >
          {plans.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          flex: 1,
          padding: '0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          minHeight: 120,
        }}
      >
        {plans.length === 0 ? (
          <div
            className="text-sm"
            style={{
              textAlign: 'center',
              opacity: 0.25,
              marginTop: '0.5rem',
              fontStyle: 'italic',
            }}
          >
            empty
          </div>
        ) : (
          plans.map((p) => <KanbanCard key={p.title} plan={p} />)
        )}
      </div>
    </div>
  );
};
