import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface OverflowCandidate {
  key: string;
  /** Lower hides first; the branch, counts, and bell are never candidates. */
  priority: number;
  width: number;
}

/** Which candidates to fold into the "more" menu so the rest fit `available`.
 *  Hides the lowest priority first, and pays for the menu button once anything hides. */
export function pickHidden(
  available: number,
  fixedWidth: number,
  candidates: OverflowCandidate[],
  moreWidth: number,
  gap: number,
): Set<string> {
  const hidden = new Set<string>();
  const order = [...candidates].sort((a, b) => a.priority - b.priority);
  const total = () =>
    fixedWidth +
    candidates.filter((c) => !hidden.has(c.key)).reduce((sum, c) => sum + c.width + gap, 0) +
    (hidden.size > 0 ? moreWidth + gap : 0);
  for (const candidate of order) {
    if (total() <= available) break;
    hidden.add(candidate.key);
  }
  return hidden;
}

const MORE_BUTTON_WIDTH = 28;
const ITEM_GAP = 12;

// Fixed refs must never wrap a candidate: measuring a group that contains foldable
// items counts them twice and makes the hide decision oscillate every layout.
export function useStatusBarOverflow(candidates: { key: string; priority: number }[]) {
  const barRef = useRef<HTMLDivElement>(null);
  const fixedRefs = useRef<Map<string, HTMLElement>>(new Map());
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const widths = useRef<Map<string, number>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const registerFixed = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) fixedRefs.current.set(key, el);
      else fixedRefs.current.delete(key);
    },
    [],
  );
  const registerItem = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(key, el);
      else itemRefs.current.delete(key);
    },
    [],
  );

  const candidatesKey = candidates.map((c) => `${c.key}:${c.priority}`).join('|');
  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const styles = getComputedStyle(bar);
    const available =
      bar.clientWidth -
      Number.parseFloat(styles.paddingLeft) -
      Number.parseFloat(styles.paddingRight);
    if (available <= 0) return;
    for (const [key, el] of itemRefs.current) widths.current.set(key, el.offsetWidth);
    let fixedWidth = 0;
    for (const el of fixedRefs.current.values()) fixedWidth += el.offsetWidth + ITEM_GAP;
    const measured = candidatesKey
      .split('|')
      .filter(Boolean)
      .map((entry) => {
        const [key, priority] = entry.split(':');
        return { key, priority: Number(priority) };
      })
      .filter((c) => widths.current.has(c.key))
      .map((c) => ({ ...c, width: widths.current.get(c.key) ?? 0 }));
    const next = pickHidden(available, fixedWidth, measured, MORE_BUTTON_WIDTH, ITEM_GAP);
    setHidden((prev) => {
      if (prev.size === next.size && [...prev].every((k) => next.has(k))) return prev;
      return next;
    });
    // biome-ignore lint/correctness/useExhaustiveDependencies: candidatesKey stands in for the array, which callers rebuild every render.
  }, [candidatesKey]);

  useLayoutEffect(() => {
    measure();
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(bar);
    return () => observer.disconnect();
  }, [measure]);

  return { barRef, registerFixed, registerItem, hidden };
}
