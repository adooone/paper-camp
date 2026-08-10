import { type DiffLineType, parsePatch, rawContentHunks } from '@/app/utils/parse-diff';
import type { FileDiffEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';

const LINE_CLASS: Record<DiffLineType, string> = {
  add: 'bg-watercolor-green/[18%] text-watercolor-green-dark',
  remove: 'bg-watercolor-rose/[18%] text-watercolor-rose-dark',
  context: '',
};

const LINE_PREFIX: Record<DiffLineType, string> = { add: '+', remove: '-', context: ' ' };

interface CountBadgeProps {
  additions: number;
  deletions: number;
}

const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span className="inline-flex shrink-0 gap-2 font-mono text-2xs">
    <span className="text-watercolor-green-dark">+{additions}</span>
    <span className="text-watercolor-rose-dark">-{deletions}</span>
  </span>
);

interface CardTitleProps {
  entry: FileDiffEntry;
}

const CardTitle = ({ entry }: CardTitleProps) => (
  <div className="flex w-full min-w-0 items-center justify-between gap-3">
    <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs">
      {entry.renameSource ? `${entry.renameSource} → ${entry.path}` : entry.path}
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {entry.staged && <Stamp size="small">staged</Stamp>}
      {!entry.binary && <CountBadge additions={entry.additions} deletions={entry.deletions} />}
    </span>
  </div>
);

interface DiffBodyProps {
  entry: FileDiffEntry;
}

const DiffBody = ({ entry }: DiffBodyProps) => {
  if (entry.binary) {
    return <p className="m-0 opacity-60">Binary file not shown.</p>;
  }
  if (entry.contentKind === 'too-large') {
    return <p className="m-0 opacity-60">File too large to preview.</p>;
  }
  const hunks =
    entry.contentKind === 'raw' ? rawContentHunks(entry.patch) : parsePatch(entry.patch);
  if (hunks.length === 0) {
    if (entry.renameSource) {
      return (
        <p className="m-0 opacity-60">
          {entry.additions === 0 && entry.deletions === 0
            ? 'Renamed, no content changes.'
            : 'Renamed with unrelated content — diff omitted.'}
        </p>
      );
    }
    return <p className="m-0 opacity-60">No changes to preview.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {hunks.map((hunk, i) => (
        <div key={`${hunk.header}-${i}`}>
          {hunk.header && <div className="mb-1 font-mono text-2xs opacity-50">{hunk.header}</div>}
          {/* paper-ui's CodeBlock has no per-line add/remove styling. */}
          <pre className="m-0 max-w-full overflow-x-auto font-mono text-2xs">
            {hunk.lines.map((line, j) => (
              <span key={`${line.type}-${j}`} className={`block ${LINE_CLASS[line.type]}`}>
                {LINE_PREFIX[line.type]}
                {line.text}
              </span>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
};

interface FileDiffSectionProps {
  entry: FileDiffEntry;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export const FileDiffSection = ({ entry, sectionRef }: FileDiffSectionProps) => (
  <div ref={sectionRef} className="min-w-0 max-w-full scroll-mt-4">
    <Card className="min-w-0 max-w-full">
      <div className="mb-3">
        <CardTitle entry={entry} />
      </div>
      <DiffBody entry={entry} />
    </Card>
  </div>
);
