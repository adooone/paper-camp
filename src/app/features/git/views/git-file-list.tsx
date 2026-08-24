import { CheckAllIcon } from '@/app/components/icons';
import { CountBadge, GitStatusMarker } from '@/app/features/git/components';
import { useGitFileList } from '@/app/features/git/hooks';
import { splitPathForDisplay } from '@/app/utils/path-display';
import { Checkbox, IconButton, ListItem, Tooltip } from '@dendelion/paper-ui';

const sectionLabelClass = 'font-handwritten text-xs font-semibold leading-none opacity-[0.45]';

const scrollToFile = (path: string, expandDiffPath: (path: string) => void) => {
  expandDiffPath(path);
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-diff-path="${CSS.escape(path)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

// Both status characters set (and neither '?', which pairs up for untracked) means
// part of the file is staged and part isn't — git can't be checked or unchecked.
const isPartiallyStaged = (status: string) => {
  const [x, y] = status;
  return x !== ' ' && x !== '?' && y !== ' ' && y !== '?';
};

export const GitFileList = () => {
  const {
    files,
    activePath,
    expandDiffPath,
    groups,
    pending,
    bulkPending,
    allStaged,
    toggleAll,
    toggleStaged,
  } = useGitFileList();

  if (!files || files.length === 0) return null;

  return (
    <nav aria-label="Changed files" className="flex flex-col">
      <div className={`${sectionLabelClass} flex h-[32px] items-end justify-between pb-1`}>
        <span>Changed files</span>
        <Tooltip content={allStaged ? 'Unstage every file' : 'Stage every file'}>
          <IconButton
            variant="ghost"
            size="tiny"
            className="-mb-1"
            disabled={bulkPending}
            label={allStaged ? 'Unstage all files' : 'Stage all files'}
            onClick={toggleAll}
            icon={<CheckAllIcon />}
          />
        </Tooltip>
      </div>
      {/* Every row is exactly one 32px cell so the list tracks the ruled background. */}
      <ul className="m-0 flex list-none flex-col p-0">
        {groups.map((group) => (
          <li key={group.dir}>
            <div
              className="flex h-[32px] items-end overflow-hidden text-ellipsis whitespace-nowrap pb-1 font-mono text-3xs leading-none opacity-50"
              title={group.dir}
            >
              {group.dir}
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {group.entries.map((entry) => (
                <li
                  key={entry.path}
                  className="pc-git-file-row flex h-[32px] min-w-0 items-end gap-1.5 pb-1"
                >
                  <Checkbox
                    checked={entry.staged}
                    indeterminate={isPartiallyStaged(entry.status)}
                    disabled={pending.has(entry.path)}
                    onChange={(e) => toggleStaged(entry, e.target.checked)}
                    aria-label={entry.staged ? `Unstage ${entry.path}` : `Stage ${entry.path}`}
                  />
                  <GitStatusMarker status={entry.status} compact />
                  <ListItem
                    size="small"
                    active={entry.path === activePath}
                    onClick={() => scrollToFile(entry.path, expandDiffPath)}
                    className="min-w-0 flex-1 items-end py-0 text-3xs"
                    action={
                      !entry.binary && (
                        <CountBadge additions={entry.additions} deletions={entry.deletions} />
                      )
                    }
                  >
                    <span
                      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-3xs"
                      title={entry.path}
                    >
                      {splitPathForDisplay(entry.path).base}
                    </span>
                  </ListItem>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
};
