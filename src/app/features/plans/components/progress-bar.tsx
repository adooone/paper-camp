import { Progress } from '@dendelion/paper-ui';

interface ProgressBarProps {
  pct: number;
  color: string;
  height?: number;
}

export const ProgressBar = ({ pct, color, height = 6 }: ProgressBarProps) => {
  return <Progress value={pct} color={color} height={height} />;
};
