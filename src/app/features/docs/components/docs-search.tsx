import { useAppStore } from '@/app/stores/app-store';

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
  const {
    decisions,
    openQuestions,
    progress,
    repoDocs,
    setActiveDocSection,
    setActiveDocTitle,
    setDocSearchQuery,
  } = useAppStore();

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
    setActiveDocSection(section);
    setActiveDocTitle(title);
    setDocSearchQuery('');
  };

  if (results.length === 0) {
    return <p style={{ opacity: 0.5 }}>No results found for "{query}".</p>;
  }

  return (
    <div>
      <p className="text-sm" style={{ opacity: 0.5, marginBottom: '0.75rem' }}>
        {results.length} result{results.length === 1 ? '' : 's'} for "{query}"
      </p>
      {Object.entries(grouped).map(([section, matches]) => (
        <div key={section} style={{ marginBottom: '1.5rem' }}>
          <h3
            className="text-xs"
            style={{
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.4,
              margin: '0 0 0.5rem',
            }}
          >
            {matches[0].sectionLabel}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {matches.map((m) => (
              <button
                key={`${m.section}-${m.title}`}
                type="button"
                onClick={() => handleSelect(m.section, m.title)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 6,
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
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
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
