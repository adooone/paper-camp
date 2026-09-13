import { color } from '@/app/styles/tokens';
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

const BAR_WIDTH = 18;
const BAR_GAP = 8;

export const BarChart = ({
  bars,
  maxValue,
  color: barColor = color.textSecondary,
  hatchedColor = color.accentRose,
  height = 80,
  className,
}: BarChartProps) => {
  const [seed] = useState(() => Math.max(1, Math.round(Math.random() * 1_000_000)));
  const max = maxValue ?? Math.max(1, ...bars.map((b) => b.value));
  const width = bars.length * (BAR_WIDTH + BAR_GAP);

  const drawnBars = useMemo(
    () =>
      bars.map((bar, i) => {
        const x = i * (BAR_WIDTH + BAR_GAP);
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
              roughGenerator.rectangle(x, height - totalHeight, BAR_WIDTH, plainHeight, {
                seed: seed + i * 2,
                roughness: 1.6,
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
              roughGenerator.rectangle(x, height - hatchedHeight, BAR_WIDTH, hatchedHeight, {
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
    [bars, max, seed, barColor, hatchedColor, height],
  );

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        {drawnBars.flat().map((p) => (
          <path key={p.key} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
        ))}
      </svg>
      <div className="flex font-handwritten text-xs" style={{ width }}>
        {bars.map((bar) => (
          <span
            key={bar.label}
            className="truncate text-center"
            style={{ width: BAR_WIDTH + BAR_GAP }}
          >
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
};
