const DEFAULT_GITHUB_CLIENT_ID = 'Iv23ligLF1oQlhORSdew';

export function githubClientId(): string {
  const configured = process.env.PAPERCAMP_GITHUB_CLIENT_ID?.trim();
  return configured || DEFAULT_GITHUB_CLIENT_ID;
}
