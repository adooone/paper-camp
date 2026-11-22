import type {
  PlanStatus,
  ResolvedRoadmapHorizon,
  ResolvedRoadmapItem,
  RoadmapItemRef,
  RoadmapRollup,
} from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

interface LabelledStamp {
  label: string;
  meaning: StampMeaning;
}

const ITEM_STATE: Record<ResolvedRoadmapItem['state'], LabelledStamp> = {
  'not-started': { label: 'not started', meaning: 'idle' },
  'in-progress': { label: 'in progress', meaning: 'parked' },
  shipped: { label: 'shipped', meaning: 'done' },
};

const IDEA_STATUS: Record<PlanStatus, LabelledStamp> = {
  idea: { label: 'idea', meaning: 'idle' },
  planned: { label: 'planned', meaning: 'running' },
  'in-progress': { label: 'in progress', meaning: 'parked' },
  review: { label: 'review', meaning: 'parked' },
  done: { label: 'done', meaning: 'done' },
  dropped: { label: 'dropped', meaning: 'failed' },
};

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const itemStateStamp = (item: ResolvedRoadmapItem): LabelledStamp => {
  if (item.state === 'in-progress' && item.readyToShip) {
    return { label: 'ready to ship', meaning: 'running' };
  }
  return ITEM_STATE[item.state];
};

export const ideaStatusStamp = (status: PlanStatus): LabelledStamp => IDEA_STATUS[status];

export const rollupFigure = (rollup: RoadmapRollup): string =>
  rollup.total === 0 ? '—' : `${rollup.done}/${rollup.total}`;

export const itemDetail = (item: ResolvedRoadmapItem): string => {
  const parts = [
    item.rollup.total === 0
      ? 'No ideas yet'
      : `${item.rollup.done} of ${item.rollup.total} shipped · ${item.rollup.open} open`,
  ];
  if (item.candidates.length > 0) {
    parts.push(
      `${item.candidates.length} ${plural(item.candidates.length, 'thought', 'thoughts')}`,
    );
  }
  return parts.join(' · ');
};

export const horizonSummary = (horizon: ResolvedRoadmapHorizon): string => {
  const notStarted = horizon.items.filter((item) => item.state === 'not-started').length;
  return `${horizon.rollup.done} of ${horizon.rollup.total} ideas shipped · ${notStarted} ${plural(notStarted, 'item', 'items')} not started`;
};

export const openUnfiled = (unfiled: RoadmapItemRef[]): RoadmapItemRef[] =>
  unfiled.filter((entity) => entity.status !== 'done' && entity.status !== 'dropped');

export const goalLine = (goal: string): string => {
  const trimmed = goal.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
};

export const matchesSearch = (item: ResolvedRoadmapItem, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    item.description.toLowerCase().includes(needle) ||
    item.candidates.some((candidate) => candidate.toLowerCase().includes(needle))
  );
};
