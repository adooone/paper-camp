import { LightbulbIcon } from '@/app/components/icons';
import { space } from '@/app/styles/tokens';
import type { SuggestionEntry } from '@/types/index';
import { Card, IconButton } from '@dendelion/paper-ui';

interface SuggestionsSectionProps {
  suggestions: SuggestionEntry[];
  onOpen: (suggestion: SuggestionEntry) => void;
  onDismiss: (suggestion: SuggestionEntry) => void;
}

export const SuggestionsSection = ({ suggestions, onOpen, onDismiss }: SuggestionsSectionProps) => {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ marginTop: space[5] }}>
      <h2 className="text-sm" style={{ margin: `0 0 ${space[2]}`, opacity: 0.6 }}>
        Suggested from AI
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        {suggestions.map((suggestion) => (
          <div key={`${suggestion.date}-${suggestion.title}`} style={{ borderRadius: 10 }}>
            <Card size="small" texture="canvas" className="plan-row-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                {/* Raw <button>, not paper-ui's Button — matches worklist-rows.tsx's titleButtonStyle. */}
                <button
                  type="button"
                  onClick={() => onOpen(suggestion)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <LightbulbIcon />
                  <span
                    style={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {suggestion.title}
                  </span>
                </button>
                <IconButton
                  icon={<span>×</span>}
                  variant="ghost"
                  size="small"
                  label="Dismiss"
                  style={{ width: 28, height: 28 }}
                  onClick={() => onDismiss(suggestion)}
                />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
