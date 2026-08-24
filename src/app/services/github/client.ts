import type { GithubCorpusConfig } from './config-store';

// `api.github.com` answers every response with `Access-Control-Allow-Origin: *` —
// the one GitHub surface reachable directly from a hosted browser client.
const API_ROOT = 'https://api.github.com';

export class GithubApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

export interface GithubFile {
  content: string;
  sha: string;
}

export interface GithubDirEntry {
  name: string;
  type: 'file' | 'dir' | string;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function request(config: GithubCorpusConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${API_ROOT}/repos/${config.owner}/${config.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new GithubApiError(
      body?.message ?? `GitHub API error (${response.status})`,
      response.status,
    );
  }
  return response.json();
}

const contentsPath = (path: string) =>
  `/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

export async function getFile(
  config: GithubCorpusConfig,
  path: string,
): Promise<GithubFile | null> {
  const body = await request(config, contentsPath(path));
  if (!body || Array.isArray(body)) return null;
  return { content: base64ToUtf8(body.content), sha: body.sha };
}

export async function listDir(config: GithubCorpusConfig, path: string): Promise<GithubDirEntry[]> {
  const body = await request(config, contentsPath(path));
  if (!Array.isArray(body)) return [];
  return body.map((entry: { name: string; type: string }) => ({
    name: entry.name,
    type: entry.type,
  }));
}

// Upsert: omit `sha` to create a new file, pass the file's current `sha` to update it —
// GitHub's Contents API rejects an update without the sha of the content being replaced.
export async function putFile(
  config: GithubCorpusConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ sha: string }> {
  const body = await request(config, contentsPath(path), {
    method: 'PUT',
    body: JSON.stringify({ message, content: utf8ToBase64(content), ...(sha && { sha }) }),
  });
  return { sha: body.content.sha };
}

export async function deleteFile(
  config: GithubCorpusConfig,
  path: string,
  sha: string,
  message: string,
): Promise<void> {
  await request(config, contentsPath(path), {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
  });
}
