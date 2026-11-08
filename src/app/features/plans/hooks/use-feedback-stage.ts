import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useEffect, useState } from 'react';

type FeedbackStage = 'reading' | 'thinking' | 'replying';

const STAGE_LINES: Record<FeedbackStage, string> = {
  reading: 'Scout is reading…',
  thinking: 'Scout is thinking…',
  replying: 'Scout is replying…',
};

const FALLBACK_LINE = 'Scout replying…';

function isLiveStage(stage: string | undefined): stage is FeedbackStage {
  return stage === 'reading' || stage === 'thinking' || stage === 'replying';
}

export function useFeedbackStage(planId: string | undefined, active: boolean): string {
  const [stage, setStage] = useState<FeedbackStage | null>(null);

  useEffect(() => {
    setStage(null);
    if (!active || !planId) return;
    return subscribeToActivityStream((payload) => {
      if (payload.type !== 'feedback' || payload.planId !== planId || !payload.stage) return;
      setStage(isLiveStage(payload.stage) ? payload.stage : null);
    });
  }, [active, planId]);

  return stage ? STAGE_LINES[stage] : FALLBACK_LINE;
}
