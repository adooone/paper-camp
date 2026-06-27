import { useCallback, useRef, useState } from 'react';

export type ActionFeedbackState = 'idle' | 'loading' | 'success' | 'error';

export function useActionFeedback() {
  const [state, setState] = useState<ActionFeedbackState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('loading');
    setErrorMessage(null);
    try {
      await action();
      setState('success');
      timerRef.current = setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      setState('error');
      setErrorMessage((err as Error).message);
      timerRef.current = setTimeout(() => {
        setState('idle');
        setErrorMessage(null);
      }, 4000);
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('idle');
    setErrorMessage(null);
  }, []);

  return {
    state,
    errorMessage,
    run,
    reset,
    loading: state === 'loading',
    success: state === 'success',
  };
}
