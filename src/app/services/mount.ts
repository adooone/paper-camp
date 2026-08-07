export function deriveMountPrefix(baseUri: string): string {
  const dir = new URL('.', baseUri).pathname;
  return dir === '/' ? '' : dir.replace(/\/+$/, '');
}

export const mountPrefix =
  typeof document === 'undefined' ? '' : deriveMountPrefix(document.baseURI);
