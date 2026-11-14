import { Button } from '@dendelion/folk-ui';

export const ChatFailureLine = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex items-center justify-end gap-2 mb-3 text-sm opacity-[0.7]">
    <span>Didn't reach Scout</span>
    <Button variant="ghost" size="small" onClick={onRetry}>
      Retry
    </Button>
  </div>
);
