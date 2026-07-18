import type { TargetAndTransition, Transition } from 'framer-motion';

export function crossfadeTransition(shouldReduceMotion: boolean | null): Transition {
  return { duration: shouldReduceMotion ? 0 : 0.15, ease: 'easeOut' };
}

// Exit's `position: 'absolute'` is applied instantly rather than interpolated, taking the
// leaving element out of flow so it overlays the entering one instead of pushing it down.
export function crossfadeVariants(shouldReduceMotion: boolean | null): {
  initial: TargetAndTransition | undefined;
  animate: TargetAndTransition;
  exit: TargetAndTransition | undefined;
} {
  return {
    initial: shouldReduceMotion ? undefined : { opacity: 0 },
    animate: { opacity: 1 },
    exit: shouldReduceMotion ? undefined : { opacity: 0, position: 'absolute', inset: 0 },
  };
}
