import type { PlanEntry, PlanStatus } from '@/types/index';

export const STATUS_COLOR: Record<PlanEntry['status'], string> = {
  'in-progress': '#C89A5A',
  planned: '#6A9B72',
  idea: '#8A9BAA',
  done: '#8A7A8A',
  dropped: '#A06060',
};

export const STATUS_LABEL: Record<PlanEntry['status'], string> = {
  idea: 'Idea',
  planned: 'Planned',
  'in-progress': 'In progress',
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
  done: 'green',
  dropped: 'rose',
};

export const STATUS_STAMP: Record<PlanEntry['status'], { fill: string; text: string }> = {
  idea: { fill: 'rgba(138, 155, 168, 0.25)', text: '#5E7080' },
  planned: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  'in-progress': { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F' },
  done: { fill: 'rgba(168, 155, 168, 0.25)', text: '#6E5E6E' },
  dropped: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A' },
};

export const STATUS_BAR_COLOR: Record<PlanEntry['status'], string> = {
  'in-progress': '#C89A5A',
  planned: '#6A9B72',
  idea: '#8A9BAA',
  done: '#8A7A8A',
  dropped: '#A06060',
};

export const KANBAN_COLUMNS: { status: PlanStatus; label: string; accent: string }[] = [
  { status: 'in-progress', label: 'In Progress', accent: '#C89A5A' },
  { status: 'planned', label: 'Planned', accent: '#6A9B72' },
  { status: 'idea', label: 'Ideas', accent: '#8A9BAA' },
  { status: 'done', label: 'Done', accent: '#8A7A8A' },
];
