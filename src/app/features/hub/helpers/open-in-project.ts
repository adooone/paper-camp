import { selectRuntime } from '@/app/services/runtime-connection';

// A full load, not a client navigation: switching runtimes repoints the API base
// set once at startup, same as choosing a project from the hub's own list.
export function openInProject(runtimeUrl: string, path: string): void {
  selectRuntime(runtimeUrl, window.localStorage);
  window.location.assign(path);
}
