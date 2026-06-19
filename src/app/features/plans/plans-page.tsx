import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { useAppStore } from '@/app/stores/app-store';
import { Alert, Button } from '@dendelion/paper-ui';
import { BoardView } from './components/board-view';
import { ListView } from './components/list-view';
import { PlanDetail } from './components/plan-detail';
import { ViewToggle } from './components/view-toggle';

export const PlansPage = () => {
  const {
    plans,
    plansError,
    activePlanTitle,
    setActivePlanTitle,
    activeIdeaTitle,
    setActiveIdeaTitle,
    view,
    setView,
    ideaEntries,
  } = useAppStore();

  const handleBack = () => {
    setActivePlanTitle(null);
    setActiveIdeaTitle(null);
  };

  const handleOpenPlan = (title: string) => {
    setActivePlanTitle(title);
    setActiveIdeaTitle(null);
  };

  const handleOpenIdea = (title: string) => {
    setActiveIdeaTitle(title);
    setActivePlanTitle(null);
  };

  const activePlan = activePlanTitle
    ? plans?.entries.find((p) => p.title === activePlanTitle)
    : null;
  const activeIdea = activeIdeaTitle ? ideaEntries.find((e) => e.title === activeIdeaTitle) : null;

  if (plansError) {
    return (
      <div>
        <PageTitle>Plans</PageTitle>
        <Alert variant="error" title="Couldn't load plans.md">
          {plansError}
        </Alert>
      </div>
    );
  }

  if (!plans) {
    return (
      <div>
        <PageTitle>Plans</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  if (activePlan) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Button variant="ghost" size="small" onClick={handleBack}>
            &larr; All plans
          </Button>
        </div>
        <PlanDetail plan={activePlan} />
      </div>
    );
  }

  if (activeIdea) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Button variant="ghost" size="small" onClick={handleBack}>
            &larr; All plans
          </Button>
        </div>
        <div
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: '1.125rem',
            lineHeight: 1.65,
            color: '#1C1B18',
          }}
        >
          <h2
            style={{
              fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
              fontWeight: 600,
              fontSize: '1.75rem',
              margin: '0 0 1rem',
              lineHeight: 1.2,
            }}
          >
            {activeIdea.title}
          </h2>
          <Markdown>
            {activeIdea.body
              .replace(/^#{1,3}\s+.+(\n|$)/, '')
              .replace(/^-{3,}\s*$/m, '')
              .trim()}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
        }}
      >
        <PageTitle>Plans</PageTitle>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {plans.warnings.length > 0 && (
        <Alert variant="warning" title="Some entries couldn't be parsed">
          <ul>
            {plans.warnings.map((w) => (
              <li key={w.title}>
                {w.title}: {w.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {plans.entries.length === 0 && ideaEntries.length === 0 ? (
        <p style={{ opacity: 0.5 }}>
          No plans yet. Run <code>paper-camp add plan &quot;name&quot;</code>, or add an idea from
          the sidebar.
        </p>
      ) : view === 'board' ? (
        <BoardView plans={plans.entries} />
      ) : (
        <ListView
          plans={plans.entries}
          activePlanTitle={activePlanTitle}
          onOpenPlan={handleOpenPlan}
          ideaEntries={ideaEntries}
          onOpenIdea={handleOpenIdea}
        />
      )}
    </div>
  );
};
