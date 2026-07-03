import { AddIdeaModal } from '@/app/components/add-idea-modal';
import { createIdea } from '@/app/services/ideas-api';
import { createPlan, deletePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Alert, IconButton, ListItem } from '@dendelion/paper-ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { CreateIdeaModal } from './create-idea-modal';
import { PlanNavItem } from './plan-nav-item';
import { SidebarSection } from './sidebar-section';

export const PlansSidebar = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    plans,
    loadPlans,
    loadIdeas,
    activePlanTitle,
    setActivePlanTitle,
    activeIdeaTitle,
    setActiveIdeaTitle,
    ideaEntries,
    gitBranchHygiene,
  } = useAppStore();
  const [addingIdea, setAddingIdea] = useState(false);
  const [creatingIdea, setCreatingIdea] = useState(false);

  // Only a merged-and-left-behind branch is "stale" — a dirty or unpushed feature
  // branch is normal work and must not be nagged to switch to main.
  const isStale = gitBranchHygiene === 'stale-merged';

  const active =
    plans?.entries.filter((p) => p.status === 'in-progress' || p.status === 'review') ?? [];
  const planned = plans?.entries.filter((p) => p.status === 'planned') ?? [];
  const ideas = plans?.entries.filter((p) => p.status === 'idea') ?? [];

  const handleAddIdea = async (idea: { title: string; content?: string; kind: string }) => {
    await createPlan(idea);
    await loadPlans();
    setAddingIdea(false);
  };

  const handleCreateIdeaEntry = async (idea: { title: string; content?: string }) => {
    await createIdea(idea);
    await loadIdeas();
    setCreatingIdea(false);
  };

  const handleDeleteIdea = async (title: string) => {
    if (!window.confirm(`Delete idea "${title}"?`)) return;
    await deletePlan(title);
    await loadPlans();
    if (activePlanTitle === title) setActivePlanTitle(null);
  };

  const handleSelectPlan = (plan: PlanEntry) => {
    navigate({ to: '/' });
    setActivePlanTitle(plan.title);
    setActiveIdeaTitle(null);
  };

  const handleSelectIdea = (title: string) => {
    setActiveIdeaTitle(title);
    setActivePlanTitle(null);
    navigate({ to: '/' });
  };

  return (
    <>
      {isStale && (
        <div style={{ marginBottom: space[4] }}>
          <Alert variant="warning">
            Branch hygiene: this branch is merged — switch to main before creating new plans.
          </Alert>
        </div>
      )}
      {active.length > 0 && (
        <SidebarSection label="In progress">
          {active.map((p) => (
            <PlanNavItem
              key={p.title}
              plan={p}
              active={pathname === '/' && activePlanTitle === p.title}
              onClick={() => handleSelectPlan(p)}
            />
          ))}
        </SidebarSection>
      )}

      {planned.length > 0 && (
        <SidebarSection label="Planned">
          {planned.map((p) => (
            <PlanNavItem
              key={p.title}
              plan={p}
              active={pathname === '/' && activePlanTitle === p.title}
              onClick={() => handleSelectPlan(p)}
            />
          ))}
        </SidebarSection>
      )}

      {ideaEntries.filter((e) => e.status !== 'done').length > 0 && (
        <SidebarSection
          label="Ideas"
          action={
            <IconButton
              icon={<span>+</span>}
              variant="ghost"
              size="small"
              label="New idea"
              onClick={() => setCreatingIdea(true)}
            />
          }
        >
          {ideaEntries
            .filter((e) => e.status !== 'done')
            .map((e) => (
              <ListItem
                key={e.title}
                size="small"
                active={activeIdeaTitle === e.title}
                onClick={() => handleSelectIdea(e.title)}
              >
                {e.title}
              </ListItem>
            ))}
        </SidebarSection>
      )}

      <SidebarSection
        label="Backlog"
        action={
          <IconButton
            icon={<span>+</span>}
            variant="ghost"
            size="small"
            label={isStale ? 'Switch to main first' : 'Add to backlog'}
            disabled={isStale}
            onClick={() => setAddingIdea(true)}
            title={isStale ? 'Switch to main first' : undefined}
          />
        }
      >
        {ideas.map((p) => (
          <PlanNavItem
            key={p.title}
            plan={p}
            active={pathname === '/' && activePlanTitle === p.title}
            onClick={() => handleSelectPlan(p)}
            action={
              <IconButton
                icon={<span>×</span>}
                variant="ghost"
                size="small"
                label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteIdea(p.title);
                }}
              />
            }
          />
        ))}
        {ideas.length === 0 && (
          <span
            className="text-sm"
            style={{
              display: 'block',
              padding: `${space[1]} ${space[3]}`,
              opacity: 0.35,
              fontStyle: 'italic',
            }}
          >
            Nothing yet
          </span>
        )}
      </SidebarSection>
      <AddIdeaModal open={addingIdea} onClose={() => setAddingIdea(false)} onAdd={handleAddIdea} />
      <CreateIdeaModal
        open={creatingIdea}
        onClose={() => setCreatingIdea(false)}
        onAdd={handleCreateIdeaEntry}
      />
    </>
  );
};
