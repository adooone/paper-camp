import { LightbulbIcon } from '@/app/components/icons';
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
    <div className="mt-5">
      <h2 className="text-sm mb-2 opacity-60">Suggested from AI</h2>
      <div className="flex flex-col gap-1">
        {suggestions.map((suggestion) => (
          <div key={`${suggestion.date}-${suggestion.title}`} className="rounded-[10px]">
            <Card size="small" texture="canvas" className="plan-row-card">
              <div className="flex items-center gap-2">
                {/* Raw <button>, not paper-ui's Button — matches worklist-rows.tsx's titleButtonStyle. */}
                <button
                  type="button"
                  onClick={() => onOpen(suggestion)}
                  className="flex-1 min-w-0 flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit"
                >
                  <LightbulbIcon />
                  <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {suggestion.title}
                  </span>
                </button>
                <IconButton
                  icon={<span>×</span>}
                  variant="ghost"
                  size="small"
                  label="Dismiss"
                  className="w-[28px] h-[28px]"
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
