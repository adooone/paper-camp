import { roughGenerator, useStableSeed } from '@dendelion/paper-ui';
import { color, colors } from '@dendelion/paper-ui/tokens';
import { useMemo } from 'react';

export interface ArcGaugeProps {
  value: number;
  max: number;
  label: string;
  /** Fraction (0-1) of `max` to mark with a tick, e.g. a floor that must not be crossed. */
  floor?: number;
  fillColor?: string;
  size?: number;
  className?: string;
}

// A 280° gauge (the 80° gap sits at the bottom) reads clearly at small sizes
// without the ends of the arc touching.
const START_DEG = -220;
const END_DEG = 40;
const SWEEP = END_DEG - START_DEG;
const STROKE_WIDTH = 6;

function pointOnArc(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = pointOnArc(cx, cy, r, startDeg);
  const end = pointOnArc(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

export const ArcGauge = ({
  value,
  max,
  label,
  floor,
  fillColor = color.textSecondary,
  size = 96,
  className,
}: ArcGaugeProps) => {
  const seed = Math.max(1, Math.round(useStableSeed() * 1_000_000));
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - STROKE_WIDTH;
  const valueDeg = START_DEG + SWEEP * pct;

  const trackPaths = useMemo(
    () =>
      roughGenerator.toPaths(
        roughGenerator.path(arcPath(cx, cy, r, START_DEG, END_DEG), {
          seed,
          roughness: 1.6,
          strokeWidth: STROKE_WIDTH,
          stroke: colors.textTertiary,
        }),
      ),
    [seed, cx, cy, r],
  );

  const fillPaths = useMemo(
    () =>
      pct > 0
        ? roughGenerator.toPaths(
            roughGenerator.path(arcPath(cx, cy, r, START_DEG, valueDeg), {
              seed: seed + 1,
              roughness: 1.6,
              strokeWidth: STROKE_WIDTH,
              stroke: fillColor,
            }),
          )
        : [],
    [seed, cx, cy, r, valueDeg, fillColor, pct],
  );

  const floorPoint =
    floor === undefined
      ? null
      : pointOnArc(cx, cy, r, START_DEG + SWEEP * Math.max(0, Math.min(1, floor)));

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        {trackPaths.map((p) => (
          <path key={p.d} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill="none" />
        ))}
        {fillPaths.map((p) => (
          <path
            key={`fill-${p.d}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
          />
        ))}
        {floorPoint && (
          <circle cx={floorPoint.x} cy={floorPoint.y} r={2.5} fill={color.textPrimary} />
        )}
      </svg>
      <div className="text-center font-handwritten text-sm">
        <div>{Math.round(pct * 100)}%</div>
        <div className="text-xs opacity-70">{label}</div>
      </div>
    </div>
  );
};
