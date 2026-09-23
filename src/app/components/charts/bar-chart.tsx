import { color } from '@dendelion/paper-ui/tokens';
import { useMemo, useState } from 'react';
import { roughGenerator } from './rough-generator';

export interface BarChartBar {
  label: string;
  value: number;
  /** Portion of `value` drawn hatched instead of solid, e.g. failed runs within a total. */
  hatchedValue?: number;
}

export interface BarChartProps {
  bars: BarChartBar[];
  maxValue?: number;
  color?: string;
  hatchedColor?: string;
  height?: number;
  className?: string;
}

// The viewBox is sized near the column's real width, so stretching it to fill the card
// leaves the pencil strokes at roughly their drawn thickness.
const VIEW_WIDTH = 190;
const BAR_GAP_RATIO = 0.32;

export const BarChart = ({
  bars,
  maxValue,
  color: barColor = color.textSecondary,
  hatchedColor = color.accentRose,
  height = 64,
  className,
}: BarChartProps) => {
  const [seed] = useState(() => Math.max(1, Math.round(Math.random() * 1_000_000)));
  const max = maxValue ?? Math.max(1, ...bars.map((b) => b.value));
  const slot = VIEW_WIDTH / Math.max(1, bars.length);
  const barWidth = slot * (1 - BAR_GAP_RATIO);

  const drawnBars = useMemo(
    () =>
      bars.map((bar, i) => {
        const x = i * slot + (slot - barWidth) / 2;
        const total = Math.min(bar.value, max);
        const hatched = Math.min(bar.hatchedValue ?? 0, total);
        const plain = total - hatched;
        const totalHeight = (total / max) * height;
        const hatchedHeight = (hatched / max) * height;
        const plainHeight = totalHeight - hatchedHeight;
        const parts = [];
        if (plain > 0) {
          parts.push(
            ...roughGenerator.toPaths(
              roughGenerator.rectangle(x, height - totalHeight, barWidth, plainHeight, {
                seed: seed + i * 2,
                roughness: 1.1,
                fill: barColor,
                fillStyle: 'solid',
                stroke: barColor,
                strokeWidth: 1,
              }),
            ),
          );
        }
        if (hatched > 0) {
          parts.push(
            ...roughGenerator.toPaths(
              roughGenerator.rectangle(x, height - hatchedHeight, barWidth, hatchedHeight, {
                seed: seed + i * 2 + 1,
                roughness: 1.6,
                fill: hatchedColor,
                fillStyle: 'hachure',
                hachureGap: 3,
                stroke: hatchedColor,
                strokeWidth: 1,
              }),
            ),
          );
        }
        return parts.map((p) => ({ ...p, key: `${bar.label}-${p.d}` }));
      }),
    [bars, max, seed, barColor, hatchedColor, height, slot, barWidth],
  );

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {drawnBars.flat().map((p) => (
          <path key={p.key} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
        ))}
      </svg>
      <div className="flex w-full font-handwritten text-2xs opacity-60">
        {bars.map((bar) => (
          <span key={bar.label} className="flex-1 truncate text-center">
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
};
