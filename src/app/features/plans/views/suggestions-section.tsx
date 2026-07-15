import { LightbulbIcon } from '@/app/components/icons';
import { space } from '@/app/styles/tokens';
import type { SuggestionEntry } from '@/types/index';
import { Card } from '@dendelion/paper-ui';

interface SuggestionsSectionProps {
  suggestions: SuggestionEntry[];
}

/**
 * IDEA-62 phase 3: the "holding pen" rendered below the worklist. Cards reuse
 * the idea-row Card styling (canvas texture, plan-row-card class) but drop
 * the id stamp and status Stamp that idea rows carry — a suggestion has
 * neither until a human promotes it, so the card is just a title. Not yet
 * clickable: the modal + "Move to ideas" flow lands in a later phase.
 */
export const SuggestionsSection = ({ suggestions }: SuggestionsSectionProps) => {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ marginTop: space[5] }}>
      <h2 className="text-sm" style={{ margin: `0 0 ${space[2]}`, opacity: 0.6 }}>
        Suggested from AI
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        {suggestions.map((suggestion) => (
          <Card key={suggestion.title} size="small" texture="canvas" className="plan-row-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
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
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
