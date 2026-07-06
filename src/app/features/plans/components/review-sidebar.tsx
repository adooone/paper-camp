import { useActivePlanTitle } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { PlanNavItem } from './plan-nav-item';
import { SidebarSection } from './sidebar-section';

export const ReviewSidebar = () => {
  const navigate = useNavigate();
  const activePlanTitle = useActivePlanTitle();
  const { plans } = useAppStore();

  const reviewPlans = plans?.entries.filter((p) => p.status === 'review') ?? [];

  const handleSelectPlan = (title: string) => {
    navigate({ to: '/review/$planId', params: { planId: encodeURIComponent(title) } });
  };

  return (
    <SidebarSection label="Pending review">
      {reviewPlans.length === 0 ? (
        <span
          className="text-sm"
          style={{
            display: 'block',
            padding: '0.25rem 0.75rem',
            opacity: 0.35,
            fontStyle: 'italic',
          }}
        >
          None
        </span>
      ) : (
        reviewPlans.map((p) => (
          <PlanNavItem
            key={p.title}
            plan={p}
            active={activePlanTitle === p.title}
            onClick={() => handleSelectPlan(p.title)}
          />
        ))
      )}
    </SidebarSection>
  );
};
