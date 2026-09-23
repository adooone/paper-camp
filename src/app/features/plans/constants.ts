import type { IdeaStatus, PlanEntry, PrState, ReviewDecision } from '@/types/index';
import type { StampVariant } from '@dendelion/paper-ui';
import { color, colors } from '@dendelion/paper-ui/tokens';

// Mirrors the resolved text colour of each status's `StampVariant` (below), so the
// status dot and its stamp always agree.
export const STATUS_COLOR: Record<PlanEntry['status'], string> = {
  'in-progress': color.accentAmberDark,
  planned: color.accentGreenDark,
  idea: color.accentSlateDark,
  review: color.accentPurpleDark,
  done: colors.textSecondary,
  dropped: color.accentRoseDark,
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
