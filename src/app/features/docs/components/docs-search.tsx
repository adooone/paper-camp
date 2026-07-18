import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, space } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface SearchMatch {
  title: string;
  snippet: string;
}

interface DocsSearchProps {
  query: string;
}

const searchIn = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.toLowerCase());

const snippet = (text: string, query: string, maxLen = 120): string => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  let s = text.slice(start, end);
  if (start > 0) s = `…${s}`;
  if (end < text.length) s = `${s}…`;
  return s;
};

export const DocsSearch = ({ query }: DocsSearchProps) => {
  const repoDocs = useAppStore((s) => s.repoDocs);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const setDocSearchQuery = useAppStore((s) => s.setDocSearchQuery);
  const navigate = useNavigate();

  const results: SearchMatch[] = [];

  for (const f of repoDocs) {
    if (searchIn(f.name, query) || searchIn(f.content, query)) {
      results.push({
        title: f.name,
        snippet: snippet(f.content, query),
      });
    }
  }

  const handleSelect = (title: string) => {
    navigate({ to: '/docs/$section', params: { section: 'repo-docs' } });
    setActiveDocTitle(title);
    setDocSearchQuery('');
  };

  if (results.length === 0) {
    return <p style={{ opacity: 0.5 }}>No results found for "{query}".</p>;
  }

  return (
    <div>
      <p className="text-sm" style={{ opacity: 0.5, marginBottom: space[3] }}>
        {results.length} result{results.length === 1 ? '' : 's'} for "{query}"
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        {results.map((m) => (
          <Button
            key={m.title}
            variant="ghost"
            size="small"
            fullWidth
            onClick={() => handleSelect(m.title)}
            style={{ justifyContent: 'flex-start', padding: `${space[2]} ${space[3]}` }}
          >
            <span style={{ textAlign: 'left' }}>
              <span
                style={{
                  fontFamily: fontFamily.serif,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  display: 'block',
                  marginBottom: '0.2rem',
                }}
              >
                {m.title}
              </span>
              <span className="text-sm" style={{ opacity: 0.6 }}>
                {m.snippet}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
