import { Markdown } from '@/app/components/markdown';
import { PageTitle } from '@/app/components/page-title';
import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import { Button, Card, Stamp, Tooltip, useToast } from '@dendelion/paper-ui';
import { BoardView } from './components/board-view';
import { ListToolbar } from './components/list-toolbar';
import { ListView } from './components/list-view';
import { PlanDetail } from './components/plan-detail';
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
      <div style={{ marginBottom: space[4] }}>
        <PageTitle>Plans</PageTitle>
      </div>

      <ListToolbar view={view} onChangeView={setView} />

      {plans.warnings.length > 0 && (
        <Card size="small" accent accentColor="amber">
          <p style={{ margin: 0, fontWeight: 600 }}>Some entries couldn't be parsed</p>
          <ul style={{ margin: 0, paddingLeft: space[5] }}>
            {plans.warnings.map((w) => (
              <li key={w.title}>
                {w.title}: {w.message}
              </li>
            ))}
          </ul>
        </Card>
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
  const { toast } = useToast();

  const handleClick = () => {
    if (!ideaId) return;
    run(async () => {
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === ideaId);
      if (!idea) return;
      try {
        await launchIdeaExtend(ideaId, buildIdeaExtendPrompt(idea));
      } catch (err) {
        toast({
          title: 'Extension failed',
          description: (err as Error).message,
          variant: 'error',
        });
        throw err;
      }
    });
  };

  const title =
    state === 'error'
      ? (errorMessage ?? 'Extension failed')
      : ideaId
        ? undefined
        : 'Idea needs an ID before an agent can run';

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={agentBusy || state === 'loading' || !ideaId}
      >
        {state === 'loading'
          ? 'Extending…'
          : state === 'success'
            ? 'Extension sent!'
            : state === 'error'
              ? 'Extension failed'
              : 'Extend with AI'}
      </Button>
    </Tooltip>
  );
};
