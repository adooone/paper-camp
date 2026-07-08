import type { IdeaStatus, PlanEntry, PrState } from '@/types/index';

export const STATUS_COLOR: Record<PlanEntry['status'], string> = {
  'in-progress': '#C89A5A',
  planned: '#6A9B72',
  idea: '#8A9BAA',
  review: '#9B7AB5',
  done: '#8A7A8A',
  dropped: '#A06060',
};

export const STATUS_LABEL: Record<PlanEntry['status'], string> = {
  idea: 'Idea',
  planned: 'Planned',
  'in-progress': 'In progress',
  review: 'Review',
  done: 'Done',
  dropped: 'Dropped',
};

export const STATUS_ACCENT: Record<
  PlanEntry['status'],
  'blue' | 'green' | 'amber' | 'rose' | 'slate'
> = {
  idea: 'slate',
  planned: 'blue',
  'in-progress': 'amber',
  review: 'slate',
  done: 'green',
  dropped: 'rose',
};

export const STATUS_STAMP: Record<PlanEntry['status'], { fill: string; text: string }> = {
  idea: { fill: 'rgba(138, 155, 168, 0.25)', text: '#5E7080' },
  planned: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  'in-progress': { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F' },
  review: { fill: 'rgba(155, 122, 181, 0.25)', text: '#7B5E9E' },
  done: { fill: 'rgba(168, 155, 168, 0.25)', text: '#6E5E6E' },
  dropped: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A' },
};

// Manual status stamp for `kind: note` ideas only — plan-bearing ideas carry no status.
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  open: 'Open',
  done: 'Done',
  dropped: 'Dropped',
};

export const IDEA_STATUS_STAMP: Record<IdeaStatus, { fill: string; text: string }> = {
  open: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  done: { fill: 'rgba(168, 155, 168, 0.25)', text: '#6E5E6E' },
  dropped: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A' },
};

export const PR_STATE_LABEL: Record<PrState, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
};

export const PR_STATE_STAMP: Record<PrState, { fill: string; text: string }> = {
  draft: { fill: 'rgba(138, 155, 168, 0.25)', text: '#5E7080' },
  open: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  closed: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A' },
  merged: { fill: 'rgba(155, 122, 181, 0.25)', text: '#7B5E9E' },
};
