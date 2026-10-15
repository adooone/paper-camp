import { useOpenEntity } from '@/app/hooks';
import type { GitLogCommit } from '@/types/index';
import { CommitRail, Divider, MetaLine, PushIcon, Row, Stamp, Tooltip } from '@dendelion/folk-ui';

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

/** `docs(papercamp)!` → `docs`; the full prefix stays in the stamp's tooltip. */
const commitType = (prefix: string): string => /^[^(!]+/.exec(prefix)?.[0] ?? prefix;

interface CommitRowProps {
  commit: GitLogCommit;
  upstream: string | null;
  isFirst: boolean;
  isLast: boolean;
}

const CommitRow = ({ commit, upstream, isFirst, isLast }: CommitRowProps) => {
  const openEntity = useOpenEntity();
  const type = commit.prefix ? commitType(commit.prefix) : null;

  return (
    <div className="flex min-w-0 items-stretch gap-3">
      <CommitRail pushed={commit.pushed} isFirst={isFirst} isLast={isLast} />
      {/* The divider lives beside the rail, not between rows, so the rail never breaks. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isFirst && <Divider sketch />}
        <Row
          surface="none"
          columns={{ id: '4.5rem', title: 'minmax(0,1fr)', meta: '9.5rem', trailing: '7.5rem' }}
          id={
            type ? (
              <span className="hidden sm:inline-flex">
                <Tooltip content={commit.prefix}>
                  <Stamp size="small" variant="neutral">
                    {type}
                  </Stamp>
                </Tooltip>
              </span>
            ) : (
              ''
            )
          }
          title={
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate">{commit.subject}</span>
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
            </span>
          }
          meta={
            <MetaLine className="flex items-baseline gap-x-1.5 overflow-hidden whitespace-nowrap">
              <span className="font-mono text-2xs">{commit.hash.slice(0, 8)}</span>
              {commit.prefix && <span className="sm:hidden">· {commit.prefix}</span>}
              <span>· {formatRelativeTime(commit.date)}</span>
            </MetaLine>
          }
          trailing={
            <>
              <span className="flex w-24 justify-end">
                {commit.ideaId && (
                  <Stamp
                    size="small"
                    variant="info"
                    onClick={() => openEntity(commit.ideaId, commit.ideaId ?? '')}
                  >
                    {commit.ideaId}
                  </Stamp>
                )}
              </span>
              {/* Slot held even when pushed, so the idea column never shifts. */}
              <span className="flex w-4 justify-center">
                {!commit.pushed && (
                  <Tooltip content="Not pushed yet">
                    <span
                      role="img"
                      aria-label="Not pushed"
                      className="inline-flex text-watercolor-amber-dark"
                    >
                      <PushIcon size={14} />
                    </span>
                  </Tooltip>
                )}
              </span>
            </>
          }
        />
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
      />
    ))}
  </div>
);
