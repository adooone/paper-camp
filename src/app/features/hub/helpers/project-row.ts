import { runtimeRowLabel } from '@/app/services/hub';
import type { ProjectEntry } from '@/app/services/project-registry';

export function projectAddress(entry: ProjectEntry): string {
  return runtimeRowLabel(entry.runtimeUrl);
}

// A nameless, unlabeled runtime has only its address — the name line collapses
// instead of repeating it.
export function projectName(entry: ProjectEntry, runtimeName: string | null): string | null {
  return entry.label ?? runtimeName;
}
