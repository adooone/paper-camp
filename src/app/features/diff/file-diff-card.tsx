import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { type DiffLineType, parsePatch, rawContentHunks } from '@/app/utils/parse-diff';
import type { FileDiffEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';

const LINE_STYLE: Record<DiffLineType, React.CSSProperties> = {
  add: { background: color.diffAddedBg, color: color.accentGreenDark },
  remove: { background: color.diffRemovedBg, color: color.accentRoseDark },
  context: {},
};

const LINE_PREFIX: Record<DiffLineType, string> = { add: '+', remove: '-', context: ' ' };

interface CountBadgeProps {
  additions: number;
  deletions: number;
}

const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span
    style={{
      display: 'inline-flex',
      gap: space[2],
      fontFamily: fontFamily.mono,
      fontSize: fontSize['2xs'],
      flexShrink: 0,
    }}
  >
    <span style={{ color: color.accentGreenDark }}>+{additions}</span>
    <span style={{ color: color.accentRoseDark }}>-{deletions}</span>
  </span>
);

interface CardTitleProps {
  entry: FileDiffEntry;
}

const CardTitle = ({ entry }: CardTitleProps) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
      width: '100%',
      minWidth: 0,
    }}
  >
    <span
      style={{
        fontFamily: fontFamily.mono,
        fontSize: fontSize.xs,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {entry.renameSource ? `${entry.renameSource} → ${entry.path}` : entry.path}
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
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
    return <p style={{ margin: 0, opacity: 0.6 }}>Binary file not shown.</p>;
  }
  if (entry.contentKind === 'too-large') {
    return <p style={{ margin: 0, opacity: 0.6 }}>File too large to preview.</p>;
  }
  const hunks =
    entry.contentKind === 'raw' ? rawContentHunks(entry.patch) : parsePatch(entry.patch);
  if (hunks.length === 0) {
    if (entry.renameSource) {
      return (
        <p style={{ margin: 0, opacity: 0.6 }}>
          {entry.additions === 0 && entry.deletions === 0
            ? 'Renamed, no content changes.'
            : 'Renamed with unrelated content — diff omitted.'}
        </p>
      );
    }
    return <p style={{ margin: 0, opacity: 0.6 }}>No changes to preview.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
      {hunks.map((hunk, i) => (
        <div key={`${hunk.header}-${i}`}>
          {hunk.header && (
            <div
              style={{
                fontFamily: fontFamily.mono,
                fontSize: fontSize['2xs'],
                opacity: 0.5,
                marginBottom: space[1],
              }}
            >
              {hunk.header}
            </div>
          )}
          {/* paper-ui's CodeBlock has no per-line add/remove styling. */}
          <pre
            style={{
              margin: 0,
              overflowX: 'auto',
              fontFamily: fontFamily.mono,
              fontSize: fontSize['2xs'],
            }}
          >
            {hunk.lines.map((line, j) => (
              <span
                key={`${line.type}-${j}`}
                style={{ display: 'block', ...LINE_STYLE[line.type] }}
              >
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
  <div ref={sectionRef} style={{ scrollMarginTop: space[4] }}>
    <Card>
      <div style={{ marginBottom: space[3] }}>
        <CardTitle entry={entry} />
      </div>
      <DiffBody entry={entry} />
    </Card>
  </div>
);
