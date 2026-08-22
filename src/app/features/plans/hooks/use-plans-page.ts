import { entityRouteParam, useActiveIdea, useActivePlan, useOpenEntity } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { ArchivableIdea, SuggestionEntry } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

export const usePlansPage = () => {
  const plans = useAppStore((s) => s.plans);
  const plansError = useAppStore((s) => s.plansError);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const suggestions = useAppStore((s) => s.suggestions);
  const setDetailView = useAppStore((s) => s.setDetailView);
  const planFilters = useAppStore((s) => s.planFilters);
  const setSubjectFilter = useAppStore((s) => s.setSubjectFilter);
  const dismissSuggestion = useAppStore((s) => s.dismissSuggestion);
  const activePlan = useActivePlan();
  const activeIdea = useActiveIdea();
  const { planId, ideaId } = useParams({ strict: false });
  const navigate = useNavigate();
  const openEntity = useOpenEntity();
  const { toast } = useToast();
  const { subject: subjectParam } = useSearch({ strict: false }) as { subject?: string };

  useEffect(() => {
    setSubjectFilter(subjectParam ?? null);
  }, [subjectParam, setSubjectFilter]);

  // Switching to a different plan/idea always lands on Details, never a stale Feedback
  // view — but the initial mount (a reload landing on an already-open entity) must not
  // stomp the detailView restored from storage, so the reset only fires on an actual change.
  const entityKey = planId ?? ideaId;
  const previousEntityKey = useRef(entityKey);
  useEffect(() => {
    if (previousEntityKey.current !== entityKey) {
      setDetailView('details');
    }
    previousEntityKey.current = entityKey;
  }, [entityKey, setDetailView]);

  const handleBack = () => {
    navigate({ to: '/' });
  };

  const handleOpenPlan = (title: string) => {
    const id = plans?.entries.find((p) => p.title === title)?.id;
    openEntity(id, title);
  };

  const handleOpenIdea = (title: string) => {
    const id = ideaEntries.find((idea) => idea.title === title)?.id;
    navigate({ to: '/ideas/$ideaId', params: { ideaId: entityRouteParam(id, title) } });
  };

  // Archivable entities are work entities, so they route to /plans and their id is
  // already to hand — `ideaEntries` holds only notes and would never resolve them.
  const handleOpenArchivable = (idea: ArchivableIdea) => {
    openEntity(idea.id, idea.title);
  };

  const [openSuggestion, setOpenSuggestion] = useState<SuggestionEntry | null>(null);

  const handleDismissSuggestion = async (suggestion: SuggestionEntry) => {
    try {
      await dismissSuggestion(suggestion);
    } catch (err) {
      toast({
        title: 'Failed to dismiss suggestion',
        description: (err as Error).message,
        variant: 'error',
      });
    }
  };

  return {
    plans,
    plansError,
    ideaEntries,
    suggestions,
    planFilters,
    activePlan,
    activeIdea,
    planId,
    ideaId,
    openSuggestion,
    setOpenSuggestion,
    handleBack,
    handleOpenPlan,
    handleOpenIdea,
    handleOpenArchivable,
    handleDismissSuggestion,
  };
};
