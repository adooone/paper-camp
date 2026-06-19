import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { Stamp } from '@dendelion/paper-ui';

export const OpenQuestionDetail = () => {
  const openQuestions = useAppStore((s) => s.openQuestions);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocSection = useAppStore((s) => s.setActiveDocSection);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);

  const question = openQuestions.find((q) => q.title === activeDocTitle);
  if (!question) return null;

  const handleResolvedByClick = () => {
    if (question.resolvedBy) {
      setActiveDocSection('decisions');
      setActiveDocTitle(question.resolvedBy);
    }
  };

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
        {question.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <span className="text-sm" style={{ opacity: 0.5 }}>{question.raised}</span>
        <Stamp
          size="small"
          fillColor={question.status === 'open' ? 'rgba(212, 163, 115, 0.25)' : 'rgba(143, 185, 150, 0.25)'}
          textColor={question.status === 'open' ? '#A67B4F' : '#5E8A66'}
        >
          {question.status}
        </Stamp>
        {question.resolvedBy && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            Resolved by{' '}
            <button
              type="button"
              onClick={handleResolvedByClick}
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
              {question.resolvedBy}
            </button>
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
        <Markdown>{question.body}</Markdown>
      </div>
    </div>
  );
};
