import { PageTitle } from '@/app/components/page-title';
import { useActivePlanTitle } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Button, Card } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { EntityDetail } from './components/entity-detail';
import { PlanCard } from './components/plan-card';

export const ReviewPage = () => {
  const { plans, plansError } = useAppStore();
  const activePlanTitle = useActivePlanTitle();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate({ to: '/review' });
  };

  const handleOpenPlan = (title: string) => {
    navigate({ to: '/review/$planId', params: { planId: encodeURIComponent(title) } });
  };

  const reviewPlans = plans?.entries.filter((p) => p.status === 'review') ?? [];
  const activePlan = activePlanTitle
    ? plans?.entries.find((p) => p.title === activePlanTitle)
    : null;

  if (plansError) {
    return (
      <div>
        <PageTitle>Review</PageTitle>
        <Card size="small" accent accentColor="rose">
          <p style={{ margin: 0, fontWeight: 600 }}>Couldn't load plans.md</p>
          <p style={{ margin: 0, opacity: 0.75 }}>{plansError}</p>
        </Card>
      </div>
    );
  }

  if (!plans) {
    return (
      <div>
        <PageTitle>Review</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  if (activePlan) {
    return (
      <div>
        <div style={{ marginBottom: space[4] }}>
          <Button variant="ghost" size="small" onClick={handleBack}>
            &larr; Back to review
          </Button>
        </div>
        <EntityDetail plan={activePlan} />
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Review</PageTitle>
      {reviewPlans.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No plans pending review.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          {reviewPlans.map((p) => (
            <PlanCard key={p.title} plan={p} onOpen={handleOpenPlan} />
          ))}
        </div>
      )}
    </div>
  );
};
