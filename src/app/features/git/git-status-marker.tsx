import { Stamp, type StampVariant } from '@dendelion/paper-ui';

interface StatusInfo {
  letter: string;
  label: string;
  variant: StampVariant;
}

// Compact rows can't spare the ~39px a Stamp's blob costs for one letter; the colour
// alone carries the same meaning in a fraction of the width.
const COMPACT_COLOR: Record<StampVariant, string> = {
  success: 'text-watercolor-green-dark',
  info: 'text-watercolor-blue-dark',
  error: 'text-watercolor-rose-dark',
  warning: 'text-watercolor-amber-dark',
  neutral: 'text-watercolor-slate-dark',
};

const STATUS_INFO: Record<string, StatusInfo> = {
  A: { letter: 'A', label: 'Added', variant: 'success' },
  M: { letter: 'M', label: 'Modified', variant: 'info' },
  D: { letter: 'D', label: 'Deleted', variant: 'error' },
  R: { letter: 'R', label: 'Renamed', variant: 'info' },
  C: { letter: 'C', label: 'Copied', variant: 'info' },
  U: { letter: 'U', label: 'Conflicted', variant: 'warning' },
};

// Git's porcelain code is two characters: index status then worktree status.
// The index one wins when both are set — it's the state that would actually commit.
export const gitStatusInfo = (status: string): StatusInfo => {
  if (status === '??') return { letter: '??', label: 'Untracked', variant: 'neutral' };
  const [x, y] = status;
  const code = x !== ' ' && x !== '?' ? x : y;
  return STATUS_INFO[code] ?? { letter: code ?? '?', label: code ?? 'Unknown', variant: 'neutral' };
};

interface GitStatusMarkerProps {
  status: string;
  compact?: boolean;
}

export const GitStatusMarker = ({ status, compact = false }: GitStatusMarkerProps) => {
  const info = gitStatusInfo(status);
  if (compact) {
    return (
      <span
        title={info.label}
        className={`w-4 shrink-0 text-center font-mono text-3xs font-semibold leading-none ${COMPACT_COLOR[info.variant] ?? ''}`}
      >
        {info.letter}
      </span>
    );
  }
  return (
    <span title={info.label}>
      <Stamp size="small" variant={info.variant}>
        {info.letter}
      </Stamp>
    </span>
  );
};
