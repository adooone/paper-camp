import { PageTitle } from '@/app/components/page-title';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { IdeaDetail } from './components/idea-detail';
import { IdeasBoard } from './components/ideas-board';

export const IdeasPage = () => {
  const { plans, activeIdeaTitle, setActiveIdeaTitle, setActivePlanTitle, ideaEntries } =
    useAppStore();
  const navigate = useNavigate();

  const activeIdea = activeIdeaTitle ? ideaEntries.find((e) => e.title === activeIdeaTitle) : null;

  const handleBack = () => setActiveIdeaTitle(null);

  const handleOpenIdea = (title: string) => setActiveIdeaTitle(title);

  const handleOpenPlan = (title: string) => {
    setActivePlanTitle(title);
    setActiveIdeaTitle(null);
    navigate({ to: '/' });
  };

  if (activeIdea) {
    return (
      <div>
        <div style={{ marginBottom: space[4] }}>
          <Button variant="ghost" size="small" onClick={handleBack}>
            &larr; All ideas
          </Button>
        </div>
        <IdeaDetail idea={activeIdea} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: space[4] }}>
        <PageTitle>Ideas</PageTitle>
      </div>

      {ideaEntries.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No ideas yet. Add one from the sidebar to get started.</p>
      ) : (
        <IdeasBoard
          ideas={ideaEntries}
          plans={plans?.entries ?? []}
          onOpenIdea={handleOpenIdea}
          onOpenPlan={handleOpenPlan}
        />
      )}
    </div>
  );
};
