import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useEffect, useRef, useState } from 'react';

interface Draft {
  text: string;
  startedAtLength: number;
}

export function useStreamedReply(planId: string | undefined, threadLength: number): string | null {
  const [draft, setDraft] = useState<Draft | null>(null);
  const lengthRef = useRef(threadLength);
  lengthRef.current = threadLength;

  useEffect(() => {
    setDraft(null);
    if (!planId) return;
    return subscribeToActivityStream((payload) => {
      if (payload.type !== 'feedback' || payload.planId !== planId) return;
      if (typeof payload.chunk === 'string') {
        const text = payload.chunk;
        setDraft((current) => ({
          text,
          startedAtLength: current?.startedAtLength ?? lengthRef.current,
        }));
      } else if (payload.stage === 'done' || payload.stage === 'failed') {
        setDraft(null);
      }
    });
  }, [planId]);

  return draft && draft.startedAtLength === threadLength ? draft.text : null;
}
