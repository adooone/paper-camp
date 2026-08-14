import { GithubIcon } from '@/app/components/icons';
import type { PrInfo } from '@/types/index';
import { Spinner, Stamp } from '@dendelion/paper-ui';
import { PR_STATE_LABEL, PR_STATE_STAMP } from '../constants';

interface PrBadgeProps {
  pr: PrInfo;
  reviewing?: boolean;
}

export const PrBadge = ({ pr, reviewing }: PrBadgeProps) => (
  <span className="inline-flex items-center gap-1">
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="no-underline inline-flex"
    >
      <Stamp
        size="small"
        fillColor={PR_STATE_STAMP[pr.state].fill}
        textColor={PR_STATE_STAMP[pr.state].text}
      >
        <span className="inline-flex items-center gap-1">
          <GithubIcon />#{pr.number} {PR_STATE_LABEL[pr.state]}
        </span>
      </Stamp>
    </a>
    {reviewing && <Spinner size="small" label={`Reviewing PR #${pr.number}`} />}
  </span>
);
