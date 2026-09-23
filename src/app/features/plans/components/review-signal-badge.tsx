import type { PrInfo } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { REVIEW_DECISION_LABEL, REVIEW_DECISION_STAMP, STATUS_STAMP } from '../constants';

interface ReviewSignalBadgeProps {
  pr: PrInfo;
}

// Renders nothing when the resolver had no signal to report (closed/merged
// PRs, or a failed `gh api` enrichment call).
export const ReviewSignalBadge = ({ pr }: ReviewSignalBadgeProps) => {
  const { reviewDecision, unresolvedThreadCount, hasNewCommentsSincePush } = pr;
  if (!reviewDecision && !unresolvedThreadCount) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {reviewDecision && (
        <Stamp size="small" variant={REVIEW_DECISION_STAMP[reviewDecision]}>
          {REVIEW_DECISION_LABEL[reviewDecision]}
        </Stamp>
      )}
      {Boolean(unresolvedThreadCount) && (
        <Stamp size="small" variant={STATUS_STAMP['in-progress']}>
          {unresolvedThreadCount} unaddressed comment{unresolvedThreadCount === 1 ? '' : 's'}
          {hasNewCommentsSincePush ? ' · new' : ''}
        </Stamp>
      )}
    </span>
  );
};
