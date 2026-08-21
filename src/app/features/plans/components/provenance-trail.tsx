import type { ProvenanceTrail } from '@/types/index';
import { Stamp, Tooltip } from '@dendelion/paper-ui';
import { PrBadge } from './pr-badge';
import { ReviewSignalBadge } from './review-signal-badge';

const REACHED_STAMP = { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' };
const UNREACHED_STAMP = { fill: 'rgba(0, 0, 0, 0.05)', text: 'rgba(0, 0, 0, 0.35)' };

interface TrailNodeProps {
  reached: boolean;
  label: string;
  tooltip?: string;
  href?: string;
}

const TrailNode = ({ reached, label, tooltip, href }: TrailNodeProps) => {
  const stamp = (
    <Stamp
      size="small"
      fillColor={reached ? REACHED_STAMP.fill : UNREACHED_STAMP.fill}
      textColor={reached ? REACHED_STAMP.text : UNREACHED_STAMP.text}
    >
      {label}
    </Stamp>
  );
  const linked = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="no-underline inline-flex"
    >
      {stamp}
    </a>
  ) : (
    stamp
  );
  return tooltip ? <Tooltip content={tooltip}>{linked}</Tooltip> : linked;
};

const TrailArrow = () => (
  <span className="opacity-30" aria-hidden="true">
    →
  </span>
);

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// Release lines are release-please's `* **scope:** Title (IDEA-N) ([hash](url))` — pull the
// commit hash and link back out of the trailing markdown link.
function parseReleaseCommit(line: string): { hash: string; url: string } | undefined {
  const match = line.match(/\(\[([0-9a-f]+)\]\((\S+)\)\)\s*$/);
  return match ? { hash: match[1], url: match[2] } : undefined;
}

interface ProvenanceTrailPanelProps {
  trail: ProvenanceTrail;
  released?: string;
  reviewing?: boolean;
  reviewNote?: string;
}

export const ProvenanceTrailPanel = ({
  trail,
  released,
  reviewing,
  reviewNote,
}: ProvenanceTrailPanelProps) => {
  const { taskRuns, commits, pr, releaseLine } = trail;
  const releaseCommit = releaseLine.data ? parseReleaseCommit(releaseLine.data) : undefined;
  const releaseLabel = released
    ? `Released ${released}`
    : releaseCommit
      ? `Released ${releaseCommit.hash}`
      : 'Release';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TrailNode
        reached={taskRuns.reached}
        label={taskRuns.data ? plural(taskRuns.data.length, 'task run') : 'Tasks'}
        tooltip={taskRuns.data?.map((run) => run.taskKind).join(', ')}
      />
      <TrailArrow />
      <TrailNode
        reached={commits.reached}
        label={commits.data ? plural(commits.data.length, 'commit') : 'Commits'}
        tooltip={commits.data?.join('\n')}
      />
      <TrailArrow />
      {pr.data ? (
        reviewNote && !reviewing ? (
          <Tooltip content={reviewNote}>
            <span className="inline-flex items-center gap-2">
              <PrBadge pr={pr.data} reviewing={reviewing} />
              <ReviewSignalBadge pr={pr.data} />
            </span>
          </Tooltip>
        ) : (
          <>
            <PrBadge pr={pr.data} reviewing={reviewing} />
            {!reviewing && <ReviewSignalBadge pr={pr.data} />}
          </>
        )
      ) : (
        <TrailNode reached={false} label="PR" />
      )}
      <TrailArrow />
      <TrailNode
        reached={releaseLine.reached || Boolean(released)}
        label={releaseLabel}
        tooltip={releaseLine.data}
        href={releaseCommit?.url}
      />
    </div>
  );
};
