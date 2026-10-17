import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { Button } from '@dendelion/folk-ui';

interface ChatFailureLineProps {
  error?: string | null;
  onRetry: () => void;
}

export const ChatFailureLine = ({ error, onRetry }: ChatFailureLineProps) => (
  <div className="flex items-center justify-end gap-2 mb-3 text-sm opacity-[0.7]">
    <span>
      {error ? `Didn't reach Scout — ${oneLineErrorSummary(error)}` : "Didn't reach Scout"}
    </span>
    <Button variant="ghost" size="small" onClick={onRetry}>
      Retry
    </Button>
  </div>
);
