import { roughGenerator } from '@/app/components/charts/rough-generator';
import { color } from '@/app/styles/tokens';
import { useMemo, useState } from 'react';

interface RoughProgressBarProps {
  done: number;
  total: number;
  width?: number;
  height?: number;
  className?: string;
}

export const RoughProgressBar = ({
  done,
  total,
  width = 96,
  height = 7,
  className,
}: RoughProgressBarProps) => {
  const [seed] = useState(() => Math.max(1, Math.round(Math.random() * 1_000_000)));
  const fillWidth = total > 0 ? (Math.min(done, total) / total) * width : 0;

  const paths = useMemo(() => {
    const track = roughGenerator.toPaths(
      roughGenerator.rectangle(0, 0, width, height, {
        seed,
        roughness: 1.2,
        fill: color.textTertiary,
        fillStyle: 'hachure',
        hachureGap: 2.5,
        stroke: color.textTertiary,
        strokeWidth: 1,
      }),
    );
    if (fillWidth <= 0) return track;
    const fill = roughGenerator.toPaths(
      roughGenerator.rectangle(0, 0, fillWidth, height, {
        seed: seed + 1,
        roughness: 1.2,
        fill: color.accentGreen,
        fillStyle: 'solid',
        stroke: color.accentGreenDark,
        strokeWidth: 1,
      }),
    );
    return [...track, ...fill];
  }, [width, height, seed, fillWidth]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      {paths.map((p) => (
        <path key={p.d} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
      ))}
    </svg>
  );
};
