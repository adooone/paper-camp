import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import { Alert, Button, Stamp } from '@dendelion/paper-ui';
import { AuditAllButton } from './components/audit-all-button';
import { BoardView } from './components/board-view';
import { ListView } from './components/list-view';
import { PlanDetail } from './components/plan-detail';
import { ViewToggle } from './components/view-toggle';
import { buildIdeaExtendPrompt } from './prompts';

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
    agentStatus,
  } = useAppStore();

  const draftingIdeaId =
    agentStatus?.ideaId && (agentStatus.status === 'starting' || agentStatus.status === 'running')
      ? agentStatus.ideaId
      : null;

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
        <div style={{ marginBottom: space[4] }}>
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
        <div style={{ marginBottom: space[4] }}>
          <Button variant="ghost" size="small" onClick={handleBack}>
            &larr; All plans
          </Button>
        </div>
        <div
          style={{
            fontFamily: fontFamily.body,
            fontSize: fontSize.base,
            lineHeight: lineHeight.relaxed,
            color: '#1C1B18',
          }}
        >
          <h2
            style={{
              fontFamily: fontFamily.serif,
              fontWeight: 600,
              fontSize: '1.75rem',
              margin: `0 0 ${space[4]}`,
              lineHeight: lineHeight.tight,
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
            }}
          >
            {activeIdea.id && (
              <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
                {activeIdea.id}
              </Stamp>
            )}
            {activeIdea.title}
          </h2>
          <Markdown>
            {activeIdea.body
              .replace(/^#{1,3}\s+.+(\n|$)/, '')
              .replace(/^-{3,}\s*$/m, '')
              .trim()}
          </Markdown>
          <div style={{ marginTop: space[6] }}>
            <ExtendWithAIButton ideaId={activeIdea.id} />
          </div>
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
          marginBottom: space[7],
        }}
      >
        <PageTitle>Plans</PageTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
          <AuditAllButton />
          <ViewToggle view={view} onChange={setView} />
        </div>
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
          draftingIdeaId={draftingIdeaId}
        />
      )}
    </div>
  );
};

const ExtendWithAIButton = ({ ideaId }: { ideaId: string | null }) => {
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const { state, errorMessage, run } = useActionFeedback();

  const handleClick = () => {
    if (!ideaId) return;
    run(async () => {
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === ideaId);
      if (!idea) return;
      await launchIdeaExtend(ideaId, buildIdeaExtendPrompt(idea));
    });
  };

  const title =
    state === 'error'
      ? (errorMessage ?? 'Extension failed')
      : ideaId
        ? undefined
        : 'Idea needs an ID before an agent can run';

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={agentBusy || state === 'loading' || !ideaId}
      title={title}
    >
      {state === 'loading'
        ? 'Extending…'
        : state === 'success'
          ? 'Extension sent!'
          : state === 'error'
            ? 'Extension failed'
            : 'Extend with AI'}
    </Button>
  );
};
