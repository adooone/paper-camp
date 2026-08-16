import { Stamp, type StampVariant } from '@dendelion/paper-ui';

interface StatusInfo {
  letter: string;
  label: string;
  variant: StampVariant;
}

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
}

export const GitStatusMarker = ({ status }: GitStatusMarkerProps) => {
  const info = gitStatusInfo(status);
  return (
    <span title={info.label}>
      <Stamp size="small" variant={info.variant}>
        {info.letter}
      </Stamp>
    </span>
  );
};
