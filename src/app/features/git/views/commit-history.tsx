import { useOpenEntity } from '@/app/hooks';
import type { GitLogCommit } from '@/types/index';
import { Divider, Stamp, roughGenerator } from '@dendelion/paper-ui';
import { color } from '@dendelion/paper-ui/tokens';
import { useMemo } from 'react';

const RAIL_WIDTH = 20;
const DOT_RADIUS = 5;
const DASH: [number, number] = [3, 3];

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
  const diffYear = Math.round(diffMonth / 12);
  return diffYear === 1 ? '1 year ago' : `${diffYear} years ago`;
}

const DOT_BOX = 14;
const LINE_VIEW_HEIGHT = 40;

interface RailLineProps {
  pushed: boolean;
  className: string;
}

// A plain stroke, not a rough one: per-row segments drawn with bowing never meet at the
// same x, so the rail read as a chain of kinks. Only the dots keep the hand-drawn look.
const RailLine = ({ pushed, className }: RailLineProps) => (
  <svg
    viewBox={`0 0 ${RAIL_WIDTH} ${LINE_VIEW_HEIGHT}`}
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`absolute left-0 w-full ${className}`}
  >
    <line
      x1={RAIL_WIDTH / 2}
      y1={0}
      x2={RAIL_WIDTH / 2}
      y2={LINE_VIEW_HEIGHT}
      stroke={pushed ? color.textSecondary : color.accentAmberDark}
      strokeWidth={1.5}
      strokeDasharray={pushed ? undefined : DASH.join(' ')}
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

interface RailSegmentProps {
  pushed: boolean;
  isFirst: boolean;
  isLast: boolean;
  seed: number;
}

const RailSegment = ({ pushed, isFirst, isLast, seed }: RailSegmentProps) => {
  const stroke = pushed ? color.textSecondary : color.accentAmberDark;
  const dot = useMemo(
    () =>
      roughGenerator.toPaths(
        roughGenerator.circle(DOT_BOX / 2, DOT_BOX / 2, DOT_RADIUS * 2, {
          seed: seed + 2,
          roughness: 0.8,
          stroke,
          strokeWidth: 1.5,
          ...(pushed ? { fill: stroke, fillStyle: 'solid' } : {}),
        }),
      ),
    [pushed, seed, stroke],
  );

  return (
    <div className="relative w-5 shrink-0 self-stretch">
      {!isFirst && <RailLine pushed={pushed} className="top-0 h-[calc(50%-8px)]" />}
      {!isLast && <RailLine pushed={pushed} className="bottom-0 h-[calc(50%-8px)]" />}
      <svg
        viewBox={`0 0 ${DOT_BOX} ${DOT_BOX}`}
        width={DOT_BOX}
        height={DOT_BOX}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {dot.map((path) => (
          <path
            key={path.d}
            d={path.d}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            fill={path.fill ?? 'none'}
          />
        ))}
      </svg>
    </div>
  );
};

interface CommitRowProps {
  commit: GitLogCommit;
  upstream: string | null;
  isFirst: boolean;
  isLast: boolean;
  seed: number;
}

const CommitRow = ({ commit, upstream, isFirst, isLast, seed }: CommitRowProps) => {
  const openEntity = useOpenEntity();

  return (
    <div className="flex min-w-0 items-stretch gap-3">
      <RailSegment pushed={commit.pushed} isFirst={isFirst} isLast={isLast} seed={seed} />
      {/* The divider lives beside the rail, not between rows, so the rail never breaks. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isFirst && <Divider sketch />}
        <div className="flex min-w-0 items-center gap-2">
          {/* Fixed column, stamp hugging the title: titles line up and the gap stays constant. */}
          <div className="hidden w-24 shrink-0 justify-end sm:flex">
            {commit.prefix && (
              <Stamp size="small" variant="neutral">
                {commit.prefix}
              </Stamp>
            )}
          </div>
          <div className="min-w-0 flex-1 py-1.5">
            <div className="truncate">{commit.subject}</div>
            <div className="flex flex-wrap items-baseline gap-x-1.5 font-handwritten text-sm leading-tight opacity-60">
              <span className="font-mono text-2xs">{commit.hash.slice(0, 8)}</span>
              {commit.prefix && <span className="sm:hidden">· {commit.prefix}</span>}
              <span>· {formatRelativeTime(commit.date)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 py-1.5">
            {commit.tags.map((tag) => (
              <Stamp key={tag} size="small" variant="success">
                {tag}
              </Stamp>
            ))}
            {commit.isUpstreamHead && upstream && (
              <Stamp size="small" variant="neutral">
                {upstream}
              </Stamp>
            )}
            {commit.ideaId && (
              // Raw <button>: a chromeless click target wrapping a stamp, not a paper-ui Button.
              <button
                type="button"
                onClick={() => openEntity(commit.ideaId, commit.ideaId ?? '')}
                className="bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit"
              >
                <Stamp size="small" variant="info">
                  {commit.ideaId}
                </Stamp>
              </button>
            )}
            {!commit.pushed && (
              <Stamp size="small" variant="warning">
                not pushed
              </Stamp>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export interface CommitHistoryProps {
  commits: GitLogCommit[];
  upstream: string | null;
}

export const CommitHistory = ({ commits, upstream }: CommitHistoryProps) => (
  <div className="flex flex-col">
    {commits.map((commit, idx) => (
      <CommitRow
        key={commit.hash}
        commit={commit}
        upstream={upstream}
        isFirst={idx === 0}
        isLast={idx === commits.length - 1}
        seed={idx * 7 + 1}
      />
    ))}
  </div>
);
