import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, space } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface SearchMatch {
  section: 'decisions' | 'questions' | 'progress' | 'repo-docs';
  sectionLabel: string;
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
  const { decisions, openQuestions, progress, repoDocs, setActiveDocTitle, setDocSearchQuery } =
    useAppStore();
  const navigate = useNavigate();

  const results: SearchMatch[] = [];

  for (const d of decisions) {
    if (searchIn(d.title, query) || searchIn(d.body, query)) {
      results.push({
        section: 'decisions',
        sectionLabel: 'Decisions',
        title: d.title,
        snippet: snippet(d.body || d.title, query),
      });
    }
  }

  for (const q of openQuestions) {
    if (searchIn(q.title, query) || searchIn(q.body, query)) {
      results.push({
        section: 'questions',
        sectionLabel: 'Open Questions',
        title: q.title,
        snippet: snippet(q.body || q.title, query),
      });
    }
  }

  for (const p of progress) {
    for (const item of p.items) {
      if (searchIn(item, query)) {
        results.push({
          section: 'progress',
          sectionLabel: 'Progress',
          title: p.date,
          snippet: snippet(item, query),
        });
        break;
      }
    }
  }

  for (const f of repoDocs) {
    if (searchIn(f.name, query) || searchIn(f.content, query)) {
      results.push({
        section: 'repo-docs',
        sectionLabel: 'Repo Docs',
        title: f.name,
        snippet: snippet(f.content, query),
      });
    }
  }

  const grouped: Record<string, SearchMatch[]> = {};
  for (const r of results) {
    if (!grouped[r.section]) grouped[r.section] = [];
    grouped[r.section].push(r);
  }

  const handleSelect = (section: SearchMatch['section'], title: string) => {
    navigate({ to: '/docs/$section', params: { section } });
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
      {Object.entries(grouped).map(([section, matches]) => (
        <div key={section} style={{ marginBottom: space[6] }}>
          <h3
            className="text-xs"
            style={{
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.4,
              margin: `0 0 ${space[2]}`,
            }}
          >
            {matches[0].sectionLabel}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
            {matches.map((m) => (
              <Button
                key={`${m.section}-${m.title}`}
                variant="ghost"
                size="small"
                fullWidth
                onClick={() => handleSelect(m.section, m.title)}
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
      ))}
    </div>
  );
};
