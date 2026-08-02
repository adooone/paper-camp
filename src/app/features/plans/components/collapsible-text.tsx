import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleTextProps {
  children: ReactNode;
  collapsedLines?: number;
  /** Changing this collapses again and re-measures — e.g. the active plan id. */
  resetKey?: string;
}

/** Uses a line-clamp (clean line-boundary cut, browser ellipsis) instead of a
 * gradient fade, which would have to guess the textured paper background colour. */
export const CollapsibleText = ({
  children,
  collapsedLines = 3,
  resetKey,
}: CollapsibleTextProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is the trigger, not read
  useLayoutEffect(() => setExpanded(false), [resetKey]);

  // A clamped element's clientHeight is fixed, so a body swap alone won't trip the ResizeObserver.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is a re-measure trigger
  useLayoutEffect(() => {
    if (expanded) return; // keep the last measurement while open, so the toggle stays
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, resetKey]);

  return (
    <div>
      <div ref={ref} className={expanded ? undefined : `line-clamp-[${collapsedLines}]`}>
        {children}
      </div>
      {/* Raw <button>: paper-ui's Button has no bare text-link variant. Conditionally
          mounted, not visibility:hidden — `overflows` is measured pre-paint. */}
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start bg-none bg-transparent border-none py-1 px-0 [font:inherit] text-xs opacity-60 cursor-pointer underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
