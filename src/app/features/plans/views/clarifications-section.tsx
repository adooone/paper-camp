import type { LogEntry } from '@/types/index';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

interface ClarificationsSectionProps {
  clarifications: LogEntry[];
}

export const ClarificationsSection = ({ clarifications }: ClarificationsSectionProps) => {
  if (clarifications.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className={`${sectionHeadingClass} mb-3`}>Clarifications</h3>
      <div className="flex flex-col gap-2 mb-3">
        {clarifications.map((entry, i) => (
          <div
            key={`clar-${entry.date}-${i}`}
            className="text-sm flex items-start justify-between gap-3 opacity-75"
          >
            <span>
              <span className="font-semibold mr-2">{entry.date}</span>
              {entry.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
