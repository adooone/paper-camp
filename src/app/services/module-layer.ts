/**
 * 'runtime' needs the machine itself — the filesystem, git, the agent
 * spawn. 'corpus' only needs to read/write papercamp/ — the runtime
 * satisfies it, but so does a device-local GitHub token. 'client' needs
 * neither.
 */
export type ModuleLayer = 'runtime' | 'corpus' | 'client';

export type ModuleReadiness = 'ready' | 'checking' | 'unreachable';

export interface RuntimeState {
  reachable: boolean;
  checking: boolean;
}

export interface CorpusState {
  githubConfigured: boolean;
}

/**
 * A route with no declared layer, or one declared 'client', never depends
 * on the runtime and renders regardless. A 'runtime' route waits out the
 * reachability probe rather than flashing content that's about to 403. A
 * 'corpus' route is 'ready' the moment either path into the corpus is
 * available — it never needs to wait out the runtime probe once a GitHub
 * token is already configured.
 */
export function moduleReadiness(
  layer: ModuleLayer | undefined,
  runtime: RuntimeState,
  corpus: CorpusState = { githubConfigured: false },
): ModuleReadiness {
  if (layer === undefined || layer === 'client') return 'ready';
  if (layer === 'corpus' && corpus.githubConfigured) return 'ready';
  if (runtime.checking) return 'checking';
  return runtime.reachable ? 'ready' : 'unreachable';
}
