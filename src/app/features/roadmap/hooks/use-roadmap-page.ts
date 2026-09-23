import { useOpenEntity } from '@/app/hooks';
import {
  addRoadmapCandidate,
  deleteRoadmapCandidate,
  patchRoadmapItem,
} from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { ResolvedRoadmapItem } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { filterHorizons } from '../helpers';

interface Promoting {
  horizonTitle: string;
  item: ResolvedRoadmapItem;
  candidateName?: string;
}

interface Editing {
  horizonTitle: string;
  item: ResolvedRoadmapItem;
}

interface Removing {
  horizonTitle: string;
  item: ResolvedRoadmapItem;
}

export const useRoadmapPage = () => {
  const roadmap = useAppStore((s) => s.roadmap);
  const roadmapError = useAppStore((s) => s.roadmapError);
  const loadRoadmap = useAppStore((s) => s.loadRoadmap);
  const filters = useAppStore((s) => s.roadmapFilters);
  const openEntity = useOpenEntity();
  const { toast } = useToast();
  const { item: highlightedItem } = useSearch({ from: '/roadmap' });
  const containerRef = useRef<HTMLDivElement>(null);
  const [promoting, setPromoting] = useState<Promoting | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  useEffect(() => {
    if (!highlightedItem || !roadmap) return;
    const row = containerRef.current?.querySelector('[class*="highlighted"]');
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedItem, roadmap]);

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

  const handleEdit = (horizonTitle: string, item: ResolvedRoadmapItem) => {
    setEditing({ horizonTitle, item });
  };

  const handleMove = async (horizonTitle: string, item: ResolvedRoadmapItem, toHorizon: string) => {
    try {
      await patchRoadmapItem(horizonTitle, item.name, { toHorizon });
      await loadRoadmap();
    } catch (err) {
      toast({
        title: 'Failed to move item',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const handleToggleShipped = async (horizonTitle: string, item: ResolvedRoadmapItem) => {
    const shipping = item.shippedOn === undefined;
    try {
      await patchRoadmapItem(horizonTitle, item.name, { shipped: shipping });
      await loadRoadmap();
    } catch (err) {
      toast({
        title: shipping ? 'Failed to mark shipped' : 'Failed to reopen',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const handleRemoveItem = (horizonTitle: string, item: ResolvedRoadmapItem) => {
    setRemoving({ horizonTitle, item });
  };

  const handleRemoveCandidate = async (
    horizonTitle: string,
    item: ResolvedRoadmapItem,
    candidateName: string,
  ) => {
    try {
      await deleteRoadmapCandidate(horizonTitle, item.name, candidateName);
      await loadRoadmap();
    } catch (err) {
      toast({
        title: 'Failed to remove candidate',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const horizons = roadmap ? filterHorizons(roadmap, filters) : [];
  const totalVisible = horizons.reduce((count, horizon) => count + horizon.items.length, 0);
  const hasActiveFilters =
    filters.horizons.length > 0 || filters.statuses.length > 0 || filters.search !== '';
  const horizonTitles = roadmap?.horizons.map((horizon) => horizon.title) ?? [];

  return {
    roadmap,
    roadmapError,
    loadRoadmap,
    horizons,
    totalVisible,
    hasActiveFilters,
    horizonTitles,
    addOpen,
    setAddOpen,
    highlightedItem,
    containerRef,
    promoting,
    setPromoting,
    editing,
    setEditing,
    removing,
    setRemoving,
    handleAddCandidate,
    handlePromote,
    handleEdit,
    handleMove,
    handleToggleShipped,
    handleRemoveItem,
    handleRemoveCandidate,
    onOpenGraduated: openEntity,
  };
};
