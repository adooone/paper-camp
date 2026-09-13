const DEFAULT_HOSTED_CLIENT_URL = 'https://paper.adoo.one';

export function hostedClientUrl(): string {
  const configured = process.env.PAPERCAMP_HOSTED_CLIENT_URL?.trim();
  return (configured || DEFAULT_HOSTED_CLIENT_URL).replace(/\/+$/, '');
}
