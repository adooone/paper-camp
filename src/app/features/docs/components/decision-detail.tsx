import { LinkButton, Markdown } from '@/app/components';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import { Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const DecisionDetail = () => {
  const decisions = useAppStore((s) => s.decisions);
  const openQuestions = useAppStore((s) => s.openQuestions);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const navigate = useNavigate();

  const decision = decisions.find((d) => d.title === activeDocTitle);
  if (!decision) return null;

  const resolvedQuestions = openQuestions.filter((q) => q.resolvedBy === decision.title);

  return (
    <div>
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: `0 0 ${space[3]}`,
          lineHeight: lineHeight.tight,
        }}
      >
        {decision.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: space[5] }}>
        <span className="text-sm" style={{ opacity: 0.5 }}>
          {decision.date}
        </span>
        <Stamp
          size="small"
          fillColor={
            decision.status === 'decided'
              ? 'rgba(143, 185, 150, 0.25)'
              : 'rgba(201, 139, 139, 0.25)'
          }
          textColor={decision.status === 'decided' ? color.accentGreenDark : '#6E3A3A'}
        >
          {decision.status}
        </Stamp>
        {decision.supersededBy && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            Superseded by{' '}
            <LinkButton onClick={() => setActiveDocTitle(decision.supersededBy!)}>
              {decision.supersededBy}
            </LinkButton>
          </span>
        )}
        {resolvedQuestions.length > 0 && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            {resolvedQuestions.length === 1 ? 'Resolves' : 'Resolves all of'}{' '}
            {resolvedQuestions.map((q, i) => (
              <span key={q.title}>
                {i > 0 && ', '}
                <LinkButton
                  onClick={() => {
                    navigate({ to: '/docs/$section', params: { section: 'questions' } });
                    setActiveDocTitle(q.title);
                  }}
                >
                  {q.title}
                </LinkButton>
              </span>
            ))}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: fontFamily.body,
          fontSize: fontSize.base,
          lineHeight: lineHeight.relaxed,
          color: '#1C1B18',
        }}
      >
        <Markdown>{decision.body}</Markdown>
      </div>
    </div>
  );
};
