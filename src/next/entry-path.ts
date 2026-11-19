export const NEXT_PATH = '/next';

export const NEXT_INDEX = `${NEXT_PATH}/index.html`;

export function nextBasepath(mountPrefix: string): string {
  return `${mountPrefix}${NEXT_PATH}`;
}

export function nextEntryFallback(pathname: string): string | null {
  if (pathname !== NEXT_PATH && !pathname.startsWith(`${NEXT_PATH}/`)) return null;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return lastSegment.includes('.') ? null : NEXT_INDEX;
}
