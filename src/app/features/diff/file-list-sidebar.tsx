import { useAppStore } from '@/app/stores/app-store';
import { ListItem, Stamp } from '@dendelion/paper-ui';

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300 mb-2';

interface CountBadgeProps {
  additions: number;
  deletions: number;
}

const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span className="inline-flex gap-2 font-mono text-2xs">
    <span className="text-watercolor-green-dark">+{additions}</span>
    <span className="text-watercolor-rose-dark">-{deletions}</span>
  </span>
);

const scrollToFile = (path: string) => {
  document
    .querySelector(`[data-diff-path="${CSS.escape(path)}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const DiffFileList = () => {
  const files = useAppStore((s) => s.diffFiles);

  if (!files || files.length === 0) return null;

  return (
    <div className="flex flex-col gap-8 -mt-5">
      <div>
        <div className={sectionLabelClass}>Changed files</div>
        <div className="flex flex-col gap-1">
          {files.map((entry) => (
            <ListItem
              key={entry.path}
              size="small"
              onClick={() => scrollToFile(entry.path)}
              action={
                <span className="flex items-center gap-2">
                  {entry.staged && <Stamp size="small">staged</Stamp>}
                  {!entry.binary && (
                    <CountBadge additions={entry.additions} deletions={entry.deletions} />
                  )}
                </span>
              }
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xs">
                {entry.path}
              </span>
            </ListItem>
          ))}
        </div>
      </div>
    </div>
  );
};
