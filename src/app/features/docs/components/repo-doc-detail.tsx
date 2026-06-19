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
      <h2
        style={{
          fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: '0 0 1rem',
          lineHeight: 1.2,
        }}
      >
        {file.name}
      </h2>

      {isMarkdown ? (
        <div
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: '1.125rem',
            lineHeight: 1.65,
            color: '#1C1B18',
          }}
        >
          <Markdown>{file.content}</Markdown>
        </div>
      ) : (
        <pre
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.85rem',
            background: 'rgba(0,0,0,0.04)',
            borderRadius: 6,
            padding: '1rem',
            overflowX: 'auto',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {file.content}
        </pre>
      )}
    </div>
  );
};
