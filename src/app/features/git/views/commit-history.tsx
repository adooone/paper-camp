import { roughGenerator } from '@/app/components/charts/rough-generator';
import { useOpenEntity } from '@/app/hooks';
import { color, surface } from '@/app/styles/tokens';
import type { GitLogCommit } from '@/types/index';
import { Card, Divider, Stamp } from '@dendelion/paper-ui';
import { Fragment, useMemo } from 'react';

const RAIL_WIDTH = 20;
const RAIL_HEIGHT = 56;
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

interface RailSegmentProps {
  pushed: boolean;
  isFirst: boolean;
  isLast: boolean;
  seed: number;
}

// A per-row segment stretches to the row's real (text-driven) height via
// preserveAspectRatio="none" and abuts the next row's segment to read as one rail.
const RailSegment = ({ pushed, isFirst, isLast, seed }: RailSegmentProps) => {
  const strokeColor = pushed ? color.textSecondary : color.accentAmberDark;
  const cx = RAIL_WIDTH / 2;
  const cy = RAIL_HEIGHT / 2;

  const paths = useMemo(() => {
    const drawables = [];
    if (!isFirst) {
      drawables.push(
        roughGenerator.line(cx, 0, cx, cy - DOT_RADIUS, {
          seed,
          roughness: 1.2,
          stroke: strokeColor,
          strokeWidth: 1.5,
          ...(pushed ? {} : { strokeLineDash: DASH }),
        }),
      );
    }
    if (!isLast) {
      drawables.push(
        roughGenerator.line(cx, cy + DOT_RADIUS, cx, RAIL_HEIGHT, {
          seed: seed + 1,
          roughness: 1.2,
          stroke: strokeColor,
          strokeWidth: 1.5,
          ...(pushed ? {} : { strokeLineDash: DASH }),
        }),
      );
    }
    drawables.push(
      roughGenerator.circle(cx, cy, DOT_RADIUS * 2, {
        seed: seed + 2,
        roughness: 1.4,
        stroke: strokeColor,
        strokeWidth: 1.5,
        ...(pushed ? { fill: strokeColor, fillStyle: 'solid' } : {}),
      }),
    );
    return drawables.flatMap((d) => roughGenerator.toPaths(d));
  }, [isFirst, isLast, pushed, seed, strokeColor, cx, cy]);

  return (
    <svg
      viewBox={`0 0 ${RAIL_WIDTH} ${RAIL_HEIGHT}`}
      width={RAIL_WIDTH}
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {paths.map((p) => (
        <path
          key={p.d}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? 'none'}
        />
      ))}
    </svg>
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
    <div className="flex min-w-0 items-stretch gap-3 py-3">
      <RailSegment pushed={commit.pushed} isFirst={isFirst} isLast={isLast} seed={seed} />
      <div className="min-w-0 flex-1">
        <div className="truncate">{commit.subject}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-handwritten text-2xs opacity-60">
          <span className="font-mono">{commit.hash.slice(0, 8)}</span>
          {commit.prefix && <span>· {commit.prefix}</span>}
          <span>· {formatRelativeTime(commit.date)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
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
  );
};

export interface CommitHistoryProps {
  commits: GitLogCommit[];
  upstream: string | null;
}

export const CommitHistory = ({ commits, upstream }: CommitHistoryProps) => (
  <Card size="small" texture={surface.card}>
    {commits.map((commit, idx) => (
      <Fragment key={commit.hash}>
        {idx > 0 && <Divider sketch />}
        <CommitRow
          commit={commit}
          upstream={upstream}
          isFirst={idx === 0}
          isLast={idx === commits.length - 1}
          seed={idx * 7 + 1}
        />
      </Fragment>
    ))}
  </Card>
);
