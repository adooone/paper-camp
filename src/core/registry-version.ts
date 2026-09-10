const REGISTRY_LATEST_URL = 'https://registry.npmjs.org/@dendelion/paper-camp/latest';
const FETCH_TIMEOUT_MS = 5_000;

export interface LatestVersionCheck {
  currentVersion: string;
  latestVersion: string;
  isNewer: boolean;
}

function versionParts(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

export function isVersionNewer(candidate: string, current: string): boolean {
  const candidateParts = versionParts(candidate);
  const currentParts = versionParts(current);
  for (let i = 0; i < Math.max(candidateParts.length, currentParts.length); i++) {
    const diff = (candidateParts[i] ?? 0) - (currentParts[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Resolves `null` on any registry or network failure, the same shape every
 *  other best-effort external check in core resolves to. */
export async function checkLatestVersion(
  currentVersion: string,
): Promise<LatestVersionCheck | null> {
  try {
    const response = await fetch(REGISTRY_LATEST_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    if (!body.version) return null;
    return {
      currentVersion,
      latestVersion: body.version,
      isNewer: isVersionNewer(body.version, currentVersion),
    };
  } catch {
    return null;
  }
}
