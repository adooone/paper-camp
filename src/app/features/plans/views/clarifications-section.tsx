import type { LogEntry } from '@/types/index';
import { SectionHeading } from '@dendelion/paper-ui';

interface ClarificationsSectionProps {
  clarifications: LogEntry[];
}

export const ClarificationsSection = ({ clarifications }: ClarificationsSectionProps) => {
  if (clarifications.length === 0) return null;
  return (
    <div className="mb-5">
      <SectionHeading as="h3" className="mb-3">
        Clarifications
      </SectionHeading>
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
