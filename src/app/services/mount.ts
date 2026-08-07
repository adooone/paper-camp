export const MOUNT_ATTRIBUTE = 'data-paper-camp-mount';

export function readMountPrefix(
  root: { getAttribute(name: string): string | null } | null,
): string {
  return root?.getAttribute(MOUNT_ATTRIBUTE) ?? '';
}

export const mountPrefix =
  typeof document === 'undefined' ? '' : readMountPrefix(document.getElementById('root'));
