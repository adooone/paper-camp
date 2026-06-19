import { IconButton } from '@dendelion/paper-ui';

interface ViewToggleProps {
  view: 'list' | 'board';
  onChange: (v: 'list' | 'board') => void;
}

export const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <IconButton
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <title>List view icon</title>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        }
        label="List view"
        title="List view"
        size="small"
        variant="ghost"
        isActive={view === 'list'}
        onClick={() => onChange('list')}
      />
      <IconButton
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <title>Board view icon</title>
            <rect x="3" y="3" width="5" height="18" rx="1" />
            <rect x="10" y="3" width="5" height="12" rx="1" />
            <rect x="17" y="3" width="5" height="15" rx="1" />
          </svg>
        }
        label="Board view"
        title="Board view"
        size="small"
        variant="ghost"
        isActive={view === 'board'}
        onClick={() => onChange('board')}
      />
    </div>
  );
};
