import { space } from '@/app/styles/tokens';
import type { PrInfo } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { REVIEW_DECISION_LABEL, REVIEW_DECISION_STAMP, STATUS_STAMP } from '../../constants';

interface ReviewSignalBadgeProps {
  pr: PrInfo;
}

/**
 * The review-state signal next to `PrBadge`: GitHub's review decision plus an
 * unresolved-thread count, so a reviewed-but-not-fixed PR is visible in the
 * worklist without opening GitHub. Renders nothing when the resolver had no
 * signal to report (closed/merged PRs, or a failed `gh api` enrichment call).
 */
export const ReviewSignalBadge = ({ pr }: ReviewSignalBadgeProps) => {
  const { reviewDecision, unresolvedThreadCount, hasNewCommentsSincePush } = pr;
  if (!reviewDecision && !unresolvedThreadCount) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[2] }}>
      {reviewDecision && (
        <Stamp
          size="small"
          fillColor={REVIEW_DECISION_STAMP[reviewDecision].fill}
          textColor={REVIEW_DECISION_STAMP[reviewDecision].text}
        >
          {REVIEW_DECISION_LABEL[reviewDecision]}
        </Stamp>
      )}
      {Boolean(unresolvedThreadCount) && (
        <Stamp
          size="small"
          fillColor={STATUS_STAMP['in-progress'].fill}
          textColor={STATUS_STAMP['in-progress'].text}
        >
          {unresolvedThreadCount} unaddressed comment{unresolvedThreadCount === 1 ? '' : 's'}
          {hasNewCommentsSincePush ? ' · new' : ''}
        </Stamp>
      )}
    </span>
  );
};
