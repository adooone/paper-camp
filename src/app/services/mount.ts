export const MOUNT_ATTRIBUTE = 'data-paper-camp-mount';

export function readMountPrefix(
  root: { getAttribute(name: string): string | null } | null,
): string {
  return root?.getAttribute(MOUNT_ATTRIBUTE) ?? '';
}

export const mountPrefix =
  typeof document === 'undefined' ? '' : readMountPrefix(document.getElementById('root'));

export function injectMountAttribute(html: string, mount: string): string {
  return html.replace('<div id="root">', `<div id="root" ${MOUNT_ATTRIBUTE}="${mount}">`);
}
