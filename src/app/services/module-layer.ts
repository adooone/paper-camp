export type ModuleLayer = 'runtime' | 'client';

export type ModuleReadiness = 'ready' | 'checking' | 'unreachable';

export interface RuntimeState {
  reachable: boolean;
  checking: boolean;
}

// A route with no declared layer, or one declared 'client', never depends on the
// runtime and renders regardless. A 'runtime' route waits out the reachability
// probe rather than flashing content that's about to 403.
export function moduleReadiness(
  layer: ModuleLayer | undefined,
  runtime: RuntimeState,
): ModuleReadiness {
  if (layer !== 'runtime') return 'ready';
  if (runtime.checking) return 'checking';
  return runtime.reachable ? 'ready' : 'unreachable';
}
