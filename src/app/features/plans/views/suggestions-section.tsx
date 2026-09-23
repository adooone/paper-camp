import type { SuggestionEntry } from '@/types/index';
import { IconButton, LightbulbIcon, Row } from '@dendelion/paper-ui';

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
          <Row
            key={`${suggestion.date}-${suggestion.title}`}
            surface="card"
            columns={{ id: '0px', title: '1fr', meta: '0px', trailing: 'auto' }}
            onClick={() => onOpen(suggestion)}
            ariaLabel={suggestion.title}
            id=""
            title={
              <span className="flex items-center gap-2">
                <LightbulbIcon size={14} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {suggestion.title}
                </span>
              </span>
            }
            meta=""
            trailing={
              <IconButton
                icon={<span>×</span>}
                variant="ghost"
                size="small"
                label="Dismiss"
                className="w-[28px] h-[28px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(suggestion);
                }}
              />
            }
          />
        ))}
      </div>
    </div>
  );
};
