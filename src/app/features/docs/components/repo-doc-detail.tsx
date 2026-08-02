import { detailHeadingClassName } from '@/app/components/detail-heading-style';
import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';

export const RepoDocDetail = () => {
  const repoDocs = useAppStore((s) => s.repoDocs);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);

  const file = repoDocs.find((f) => f.name === activeDocTitle);
  if (!file) return null;

  const isMarkdown = file.name.endsWith('.md');

  return (
    <div>
      <h2 className={`${detailHeadingClassName} m-0 mb-4`}>{file.name}</h2>

      {isMarkdown ? (
        <div className="text-base leading-[1.7] text-ink-900">
          <Markdown>{file.content}</Markdown>
        </div>
      ) : (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-black/[4%] p-4 font-mono text-xs leading-normal">
          {file.content}
        </pre>
      )}
    </div>
  );
};
