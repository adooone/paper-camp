const DEFAULT_GITHUB_CLIENT_ID = 'Iv23ligLF1oQlhORSdew';

export function githubClientId(): string {
  const configured = process.env.PAPERCAMP_GITHUB_CLIENT_ID?.trim();
  return configured || DEFAULT_GITHUB_CLIENT_ID;
}

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface GithubProxyResponse {
  status: number;
  body: unknown;
}

async function postToGithub(
  url: string,
  params: Record<string, string>,
): Promise<GithubProxyResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return { status: response.status, body: await response.json() };
}

export function requestDeviceCode(): Promise<GithubProxyResponse> {
  return postToGithub(DEVICE_CODE_URL, { client_id: githubClientId() });
}

export function requestDeviceToken(deviceCode: string): Promise<GithubProxyResponse> {
  return postToGithub(ACCESS_TOKEN_URL, {
    client_id: githubClientId(),
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
}
