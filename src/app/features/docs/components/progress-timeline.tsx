import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';

export const ProgressTimeline = () => {
  const progress = useAppStore((s) => s.progress);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);

  const entries = activeDocTitle
    ? progress.filter((p) => p.date === activeDocTitle)
    : progress;

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return <p style={{ opacity: 0.5 }}>No progress entries found.</p>;
  }

  return (
    <div>
      {sorted.map((entry) => (
        <div key={entry.date} style={{ marginBottom: '2rem' }}>
          <h3
            style={{
              fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
              fontWeight: 600,
              fontSize: '1.25rem',
              margin: '0 0 0.75rem',
              lineHeight: 1.2,
              opacity: 0.8,
            }}
          >
            {entry.date}
          </h3>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {entry.items.map((item, i) => (
              <li
                key={item}
                style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize: '1rem',
                  lineHeight: 1.55,
                  color: '#1C1B18',
                  paddingLeft: '1rem',
                  borderLeft: '2px solid rgba(0,0,0,0.08)',
                }}
              >
                <Markdown>{item}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
