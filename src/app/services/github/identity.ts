import { GithubApiError } from './client';

const API_ROOT = 'https://api.github.com';

export interface GithubIdentity {
  login: string;
  avatarUrl: string;
}

async function request(token: string, path: string) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new GithubApiError(
      body?.message ?? `GitHub API error (${response.status})`,
      response.status,
    );
  }
  return response.json();
}

export async function fetchGithubIdentity(token: string): Promise<GithubIdentity> {
  const body = await request(token, '/user');
  return { login: body.login, avatarUrl: body.avatar_url };
}

export async function fetchAccessibleRepoNames(token: string): Promise<string[]> {
  const body = await request(token, '/user/repos?per_page=100&affiliation=owner,collaborator');
  if (!Array.isArray(body)) return [];
  return body.map((repo: { full_name: string }) => repo.full_name);
}
