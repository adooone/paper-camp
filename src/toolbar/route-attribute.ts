export const TOOLBAR_SCRIPT_ID = 'paper-camp-toolbar-script';
export const ROUTE_ATTRIBUTE = 'data-route';

export function scriptOrigin(script: { src: string } | null | undefined): string | undefined {
  if (!script?.src) return undefined;
  try {
    return new URL(script.src).origin;
  } catch {
    return undefined;
  }
}
