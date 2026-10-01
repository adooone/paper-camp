import { useOpenEntity } from '@/app/hooks';
import type { GitLogCommit } from '@/types/index';
import { CommitRail, Divider, MetaLine, Row, Stamp } from '@dendelion/paper-ui';

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

interface CommitRowProps {
  commit: GitLogCommit;
  upstream: string | null;
  isFirst: boolean;
  isLast: boolean;
}

const CommitRow = ({ commit, upstream, isFirst, isLast }: CommitRowProps) => {
  const openEntity = useOpenEntity();

  return (
    <div className="flex min-w-0 items-stretch gap-3">
      <CommitRail pushed={commit.pushed} isFirst={isFirst} isLast={isLast} />
      {/* The divider lives beside the rail, not between rows, so the rail never breaks. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isFirst && <Divider sketch />}
        <Row
          surface="none"
          columns={{ id: '6rem', title: 'minmax(0,1fr)', meta: 'auto', trailing: 'auto' }}
          id={
            commit.prefix ? (
              <span className="hidden sm:inline-flex">
                <Stamp size="small" variant="neutral">
                  {commit.prefix}
                </Stamp>
              </span>
            ) : (
              ''
            )
          }
          title={<div className="truncate">{commit.subject}</div>}
          meta={
            <MetaLine className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-mono text-2xs">{commit.hash.slice(0, 8)}</span>
              {commit.prefix && <span className="sm:hidden">· {commit.prefix}</span>}
              <span>· {formatRelativeTime(commit.date)}</span>
            </MetaLine>
          }
          trailing={
            <>
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
                <Stamp
                  size="small"
                  variant="info"
                  onClick={() => openEntity(commit.ideaId, commit.ideaId ?? '')}
                >
                  {commit.ideaId}
                </Stamp>
              )}
              {!commit.pushed && (
                <Stamp size="small" variant="warning">
                  not pushed
                </Stamp>
              )}
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
