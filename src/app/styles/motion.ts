import type { TargetAndTransition, Transition } from 'framer-motion';

export function crossfadeTransition(shouldReduceMotion: boolean | null, delay = 0): Transition {
  return shouldReduceMotion
    ? { duration: 0, ease: 'easeOut' }
    : { duration: 0.18, ease: 'easeOut', delay };
}

export function crossfadeVariants(
  shouldReduceMotion: boolean | null,
  from: { x?: number; y?: number } = { y: 8 },
): {
  initial: TargetAndTransition | undefined;
  animate: TargetAndTransition;
} {
  return {
    initial: shouldReduceMotion ? undefined : { opacity: 0, ...from },
    animate: { opacity: 1, x: 0, y: 0 },
  };
}
