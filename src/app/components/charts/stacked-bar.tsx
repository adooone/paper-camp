import { roughGenerator, useStableSeed } from '@dendelion/paper-ui';
import { useMemo } from 'react';

export interface StackedBarSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarProps {
  segments: StackedBarSegment[];
  width?: number;
  height?: number;
  className?: string;
}

export const StackedBar = ({ segments, width = 240, height = 20, className }: StackedBarProps) => {
  const seed = Math.max(1, Math.round(useStableSeed() * 1_000_000));
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );

  const paths = useMemo(() => {
    let x = 0;
    return segments.flatMap((segment, i) => {
      const segmentWidth = (segment.value / total) * width;
      if (segmentWidth <= 0) return [];
      const drawn = roughGenerator.toPaths(
        roughGenerator.rectangle(x, 0, segmentWidth, height, {
          seed: seed + i,
          roughness: 1.4,
          fill: segment.color,
          fillStyle: 'solid',
          stroke: segment.color,
          strokeWidth: 1,
        }),
      );
      x += segmentWidth;
      return drawn.map((p) => ({ ...p, key: `${segment.label}-${p.d}` }));
    });
  }, [segments, total, width, height, seed]);

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        {paths.map((p) => (
          <path key={p.key} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-handwritten text-xs">
        {segments.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            {segment.label} {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
};
