import { Progress } from '@dendelion/paper-ui';

interface MiniProgressProps {
  pct: number;
  color: string;
}

export const MiniProgress = ({ pct, color }: MiniProgressProps) => {
  return (
    <div style={{ width: 40, flexShrink: 0 }}>
      <Progress value={pct} color={color} height={3} />
    </div>
  );
};
