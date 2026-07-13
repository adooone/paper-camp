import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';

export const ProgressTimeline = () => {
  const progress = useAppStore((s) => s.progress);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);

  const entries = activeDocTitle ? progress.filter((p) => p.date === activeDocTitle) : progress;

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return <p style={{ opacity: 0.5 }}>No progress entries found.</p>;
  }

  return (
    <div>
      {sorted.map((entry) => (
        <div key={entry.date} style={{ marginBottom: space[8] }}>
          <h3
            style={{
              fontFamily: fontFamily.serif,
              fontWeight: 600,
              fontSize: fontSize.md,
              margin: `0 0 ${space[3]}`,
              lineHeight: lineHeight.tight,
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
              gap: space[2],
            }}
          >
            {entry.items.map((item, i) => (
              <li
                key={`${entry.date}-${i}`}
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: fontSize.sm,
                  lineHeight: 1.55,
                  color: color.textProse,
                  paddingLeft: space[4],
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
