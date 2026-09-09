const STORAGE_KEY = 'papercamp:machines';
const TOKENS_KEY = 'papercamp:machine-tokens';

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

function readTokens(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The pairing token a machine's link carried, so a project can be opened
 * from that machine on a later visit that carries no link at all. */
export function machineToken(url: string): string | null {
  return readTokens()[normalizeMachineUrl(url)] ?? null;
}

export function addMachine(url: string, pairingToken: string | null = null): void {
  try {
    const normalized = normalizeMachineUrl(url);
    if (pairingToken) {
      localStorage.setItem(
        TOKENS_KEY,
        JSON.stringify({ ...readTokens(), [normalized]: pairingToken }),
      );
    }
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
    const { [normalized]: _forgotten, ...tokens } = readTokens();
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // localStorage unavailable
  }
}
