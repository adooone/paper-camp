/** Pure predicate driving the toolbar's dock→pill collapse: idle time past the
 * threshold collapses it, unless a segment panel is open. */
export function shouldCollapse(
  msSinceActivity: number,
  idleMs: number,
  hasOpenPanel: boolean,
): boolean {
  if (hasOpenPanel) return false;
  return msSinceActivity >= idleMs;
}
