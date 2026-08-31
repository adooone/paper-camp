import { runtimeRowLabel } from '@/app/services/hub';
import type { ProjectEntry } from '@/app/services/project-registry';

export function projectAddress(entry: ProjectEntry): string {
  return entry.kind === 'runtime'
    ? runtimeRowLabel(entry.runtimeUrl)
    : `${entry.owner}/${entry.repo}`;
}

// A nameless, unlabeled runtime has only its address — the name line collapses
// instead of repeating it. A GitHub entry always has its repo name to fall back on.
export function projectName(entry: ProjectEntry, runtimeName: string | null): string | null {
  if (entry.label) return entry.label;
  return entry.kind === 'runtime' ? runtimeName : entry.repo;
}
