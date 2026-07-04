import { PageTitle } from '@/app/components/page-title';
import { deletePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import type { PlanStatus } from '@/types/index';
import { Button, Card } from '@dendelion/paper-ui';
import { useState } from 'react';
import { BoardView } from './components/board-view';
import { ListView } from './components/list-view';
import { PlanDetail } from './components/plan-detail';
import { PlanFilterCard } from './components/plan-filter-card';
import {
  DEFAULT_PLAN_LIST_FILTERS,
  DEFAULT_VISIBLE_STATUSES,
  type PlanSortKey,
  type SortDirection,
  selectPlanRows,
} from './plan-list-selector';

export const PlansPage = () => {
  const {
    plans,
    plansError,
    activePlanTitle,
    setActivePlanTitle,
    view,
    setView,
    agentStatus,
    loadPlans,
  } = useAppStore();

  const [statuses, setStatuses] = useState<PlanStatus[]>(DEFAULT_VISIBLE_STATUSES);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<PlanSortKey>(DEFAULT_PLAN_LIST_FILTERS.sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_PLAN_LIST_FILTERS.sortDirection,
  );

  const toggleStatus = (status: PlanStatus) => {
    setStatuses((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status],
    );
  };

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  const draftingIdeaId =
    agentStatus?.ideaId && (agentStatus.status === 'starting' || agentStatus.status === 'running')
      ? agentStatus.ideaId
      : null;

  const handleBack = () => {
    setActivePlanTitle(null);
  };

  const handleOpenPlan = (title: string) => {
    setActivePlanTitle(title);
  };

  const handleDeleteIdea = async (title: string) => {
    if (!window.confirm(`Delete idea "${title}"?`)) return;
    await deletePlan(title);
    await loadPlans();
    if (activePlanTitle === title) setActivePlanTitle(null);
  };

  const activePlan = activePlanTitle
    ? plans?.entries.find((p) => p.title === activePlanTitle)
    : null;

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

  const { rows, statusCounts, tagCounts } = selectPlanRows(plans.entries, {
    ...DEFAULT_PLAN_LIST_FILTERS,
    statuses,
    tags,
    search,
    sortKey,
    sortDirection,
  });

  return (
    <div>
      <div style={{ marginBottom: space[4] }}>
        <PageTitle>Plans</PageTitle>
      </div>

      <PlanFilterCard
        view={view}
        onChangeView={setView}
        statusCounts={statusCounts}
        activeStatuses={statuses}
        onToggleStatus={toggleStatus}
        tagCounts={tagCounts}
        activeTags={tags}
        onToggleTag={toggleTag}
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDirection={sortDirection}
        onToggleSortDirection={toggleSortDirection}
      />

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

      {plans.entries.length === 0 ? (
        <p style={{ opacity: 0.5 }}>
          No plans yet. Run <code>paper-camp add plan &quot;name&quot;</code>, or add one to the
          backlog above.
        </p>
      ) : view === 'board' ? (
        <BoardView plans={plans.entries} />
      ) : (
        <ListView
          plans={plans.entries}
          rows={rows}
          activePlanTitle={activePlanTitle}
          onOpenPlan={handleOpenPlan}
          onDeleteIdea={handleDeleteIdea}
          draftingIdeaId={draftingIdeaId}
        />
      )}
    </div>
  );
};
