import { useOpenEntity } from '@/app/hooks';
import { addRoadmapCandidate } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry, ResolvedRoadmapItem } from '@/types/index';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { filterHorizons } from '../helpers';

interface Promoting {
  horizonTitle: string;
  item: ResolvedRoadmapItem;
  candidateName?: string;
}

export const useRoadmapPage = () => {
  const roadmap = useAppStore((s) => s.roadmap);
  const roadmapError = useAppStore((s) => s.roadmapError);
  const loadRoadmap = useAppStore((s) => s.loadRoadmap);
  const filters = useAppStore((s) => s.roadmapFilters);
  const plans = useAppStore((s) => s.plans);
  const openEntity = useOpenEntity();
  const { item: highlightedItem } = useSearch({ from: '/roadmap' });
  const containerRef = useRef<HTMLDivElement>(null);
  const [promoting, setPromoting] = useState<Promoting | null>(null);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  useEffect(() => {
    if (!highlightedItem || !roadmap) return;
    const row = containerRef.current?.querySelector('.roadmap-item-highlighted');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedItem, roadmap]);

  const graduatedByItem = (item: ResolvedRoadmapItem): PlanEntry[] =>
    plans?.entries.filter((p) => p.subject === item.name) ?? [];

  const handleAddCandidate = async (horizonTitle: string, itemName: string, name: string) => {
    await addRoadmapCandidate(horizonTitle, itemName, name);
    await loadRoadmap();
  };

  const handlePromote = (
    horizonTitle: string,
    item: ResolvedRoadmapItem,
    candidateName?: string,
  ) => {
    setPromoting({ horizonTitle, item, candidateName });
  };

  const horizons = roadmap ? filterHorizons(roadmap, filters) : [];
  const totalVisible = horizons.reduce((count, horizon) => count + horizon.items.length, 0);
  const hasActiveFilters = filters.horizons.length > 0 || filters.statuses.length > 0;

  return {
    roadmap,
    roadmapError,
    loadRoadmap,
    horizons,
    totalVisible,
    hasActiveFilters,
    highlightedItem,
    containerRef,
    promoting,
    setPromoting,
    graduatedByItem,
    handleAddCandidate,
    handlePromote,
    onOpenGraduated: openEntity,
  };
};
