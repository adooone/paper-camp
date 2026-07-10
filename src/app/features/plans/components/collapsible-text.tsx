import { fontSize, space } from '@/app/styles/tokens';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleTextProps {
  children: ReactNode;
  /** Lines shown while collapsed. */
  collapsedLines?: number;
  /** Changing this collapses again and re-measures — e.g. the active plan id. */
  resetKey?: string;
}

/**
 * Clamps long body text to the first few lines with a "Show more" toggle, so a
 * long idea rationale doesn't push the phases/actions below the fold. Uses a
 * line-clamp (clean cut on a line boundary, browser-drawn ellipsis) rather than a
 * gradient fade, which would have to guess the textured paper background colour.
 * The toggle only appears when the content actually overflows the clamp.
 */
export const CollapsibleText = ({
  children,
  collapsedLines = 3,
  resetKey,
}: CollapsibleTextProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // A new entity collapses again from the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is the trigger, not read
  useLayoutEffect(() => setExpanded(false), [resetKey]);

  // resetKey re-measures on entity change: a clamped element's clientHeight is
  // fixed, so a body swap alone won't trip the ResizeObserver below.
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
      <div
        ref={ref}
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: collapsedLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            padding: `${space[1]} 0`,
            font: 'inherit',
            fontSize: fontSize.xs,
            opacity: 0.6,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
