import type { IdeaStatus, PlanEntry, PrState, ReviewDecision } from '@/types/index';
import type { StampVariant } from '@dendelion/paper-ui';

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

export const STATUS_STAMP: Record<PlanEntry['status'], StampVariant> = {
  idea: 'idea',
  planned: 'success',
  'in-progress': 'warning',
  review: 'review',
  done: 'muted',
  dropped: 'dropped',
};

// Manual status stamp for `kind: note` ideas only — plan-bearing ideas carry no status.
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  open: 'Open',
  done: 'Done',
  dropped: 'Dropped',
};

export const IDEA_STATUS_STAMP: Record<IdeaStatus, StampVariant> = {
  open: 'success',
  done: 'muted',
  dropped: 'dropped',
};

export const PR_STATE_LABEL: Record<PrState, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
};

export const PR_STATE_STAMP: Record<PrState, StampVariant> = {
  draft: 'neutral',
  open: 'success',
  closed: 'dropped',
  merged: 'review',
};

export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  approved: 'Approved',
  'changes-requested': 'Changes requested',
  'review-required': 'Review required',
};

export const REVIEW_DECISION_STAMP: Record<ReviewDecision, StampVariant> = {
  approved: 'success',
  'changes-requested': 'dropped',
  'review-required': 'warning',
};
