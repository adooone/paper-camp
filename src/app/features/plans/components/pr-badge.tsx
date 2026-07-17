import { GithubIcon } from '@/app/components/icons';
import { space } from '@/app/styles/tokens';
import type { PrInfo } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { PR_STATE_LABEL, PR_STATE_STAMP } from '../constants';

interface PrBadgeProps {
  pr: PrInfo;
}

export const PrBadge = ({ pr }: PrBadgeProps) => (
  <a
    href={pr.url}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    style={{ textDecoration: 'none', display: 'inline-flex' }}
  >
    <Stamp
      size="small"
      fillColor={PR_STATE_STAMP[pr.state].fill}
      textColor={PR_STATE_STAMP[pr.state].text}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[1] }}>
        <GithubIcon />#{pr.number} {PR_STATE_LABEL[pr.state]}
      </span>
    </Stamp>
  </a>
);
