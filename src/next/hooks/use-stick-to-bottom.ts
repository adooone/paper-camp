import { useEffect, useRef } from 'react';

const NEAR_END_PX = 80;

const distanceFromEnd = (): number =>
  document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);

export function useStickToBottom(signal: unknown): void {
  const nearEnd = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      nearEnd.current = distanceFromEnd() < NEAR_END_PX;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new signal is the trigger to follow the thread, not a value the body reads.
  useEffect(() => {
    if (nearEnd.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [signal]);
}
