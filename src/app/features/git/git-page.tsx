import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const GitPage = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4">
        <Breadcrumb
          items={[
            { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
            { id: 'git', label: 'Git' },
          ]}
        />
      </div>
      <div className="min-h-page">
        <p className="opacity-50">Nothing here yet.</p>
      </div>
    </div>
  );
};
