import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { type DiffLineType, parsePatch } from '@/app/utils/parse-diff';
import type { FileDiffEntry } from '@/types/index';
import { Accordion, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';

const LINE_STYLE: Record<DiffLineType, React.CSSProperties> = {
  add: { background: 'rgba(143, 185, 150, 0.18)', color: color.accentGreenDark },
  remove: { background: 'rgba(201, 139, 139, 0.18)', color: color.accentRoseDark },
  context: {},
};

const LINE_PREFIX: Record<DiffLineType, string> = { add: '+', remove: '-', context: ' ' };

const CountBadge = ({ additions, deletions }: { additions: number; deletions: number }) => (
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

const CardTitle = ({ entry }: { entry: FileDiffEntry }) => (
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

const DiffBody = ({ entry }: { entry: FileDiffEntry }) => {
  if (entry.binary) {
    return <p style={{ margin: 0, opacity: 0.6 }}>Binary file not shown.</p>;
  }
  const hunks = parsePatch(entry.patch);
  if (hunks.length === 0) {
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
          {/* Raw <pre>/<div> lines: paper-ui's CodeBlock has no per-line add/remove styling. */}
          <pre style={{ margin: 0, fontFamily: fontFamily.mono, fontSize: fontSize['2xs'] }}>
            {hunk.lines.map((line, j) => (
              <div key={`${line.type}-${j}`} style={LINE_STYLE[line.type]}>
                {LINE_PREFIX[line.type]}
                {line.text}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
};

export const FileDiffCard = ({ entry }: { entry: FileDiffEntry }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Accordion
      title={<CardTitle entry={entry} />}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      <DiffBody entry={entry} />
    </Accordion>
  );
};
