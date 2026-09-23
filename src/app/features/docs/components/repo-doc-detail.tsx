import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { Text } from '@dendelion/paper-ui';

export const RepoDocDetail = () => {
  const repoDocs = useAppStore((s) => s.repoDocs);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);

  const file = repoDocs.find((f) => f.name === activeDocTitle);
  if (!file) return null;

  const isMarkdown = file.name.endsWith('.md');

  return (
    <div>
      <Text as="h2" face="display" weight="semibold" className="text-[1.75rem] leading-[1.2] mb-4">
        {file.name}
      </Text>

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
