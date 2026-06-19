import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { Stamp } from '@dendelion/paper-ui';

export const DecisionDetail = () => {
  const decisions = useAppStore((s) => s.decisions);
  const openQuestions = useAppStore((s) => s.openQuestions);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocSection = useAppStore((s) => s.setActiveDocSection);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);

  const decision = decisions.find((d) => d.title === activeDocTitle);
  if (!decision) return null;

  const resolvedQuestions = openQuestions.filter((q) => q.resolvedBy === decision.title);

  return (
    <div>
      <h2
        style={{
          fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: '0 0 0.75rem',
          lineHeight: 1.2,
        }}
      >
        {decision.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <span className="text-sm" style={{ opacity: 0.5 }}>{decision.date}</span>
        <Stamp
          size="small"
          fillColor={decision.status === 'decided' ? 'rgba(143, 185, 150, 0.25)' : 'rgba(201, 139, 139, 0.25)'}
          textColor={decision.status === 'decided' ? '#5E8A66' : '#6E3A3A'}
        >
          {decision.status}
        </Stamp>
        {decision.supersededBy && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            Superseded by{' '}
            <button
              type="button"
              onClick={() => setActiveDocTitle(decision.supersededBy!)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#A67B4F',
                cursor: 'pointer',
                textDecoration: 'underline',
                font: 'inherit',
              }}
            >
              {decision.supersededBy}
            </button>
          </span>
        )}
        {resolvedQuestions.length > 0 && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            {resolvedQuestions.length === 1 ? 'Resolves' : 'Resolves'}{' '}
            {resolvedQuestions.map((q, i) => (
              <span key={q.title}>
                {i > 0 && ', '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDocSection('questions');
                    setActiveDocTitle(q.title);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#A67B4F',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    font: 'inherit',
                  }}
                >
                  {q.title}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: '1.125rem',
          lineHeight: 1.65,
          color: '#1C1B18',
        }}
      >
        <Markdown>{decision.body}</Markdown>
      </div>
    </div>
  );
};
