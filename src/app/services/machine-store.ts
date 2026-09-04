const STORAGE_KEY = 'papercamp:machines';

function parseMachines(raw: string | null): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

// Strips a trailing slash so a link's `https://host/` dedupes against a typed
// `https://host` and both compose cleanly with `machineProjectRuntimeUrl`.
function normalizeMachineUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Device-local, like `hub-token-store.ts` — the machines this browser has
 * paired with by following a daemon's link, kept apart from
 * `project-registry.ts` so that store stays projects-only.
 */
export function listMachines(): string[] {
  try {
    return parseMachines(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function addMachine(url: string): void {
  try {
    const normalized = normalizeMachineUrl(url);
    const machines = parseMachines(localStorage.getItem(STORAGE_KEY));
    if (machines.includes(normalized)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...machines, normalized]));
  } catch {
    // localStorage unavailable (e.g. private browsing) — the machine can't persist here
  }
}

export function removeMachine(url: string): void {
  try {
    const normalized = normalizeMachineUrl(url);
    const machines = parseMachines(localStorage.getItem(STORAGE_KEY)).filter(
      (machine) => machine !== normalized,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
  } catch {
    // localStorage unavailable
  }
}
