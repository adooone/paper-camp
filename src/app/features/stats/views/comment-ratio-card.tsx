import type { ProjectStats } from '@/types/index';
import { Progress } from '@dendelion/paper-ui';
import { color } from '@dendelion/paper-ui/tokens';
import { pct } from '../helpers';
import { StatCard, StatRow } from './stat-card';

export interface CommentRatioCardProps {
  comments: ProjectStats['comments'];
}

export const CommentRatioCard = ({ comments }: CommentRatioCardProps) => (
  <StatCard title="Comment ratio">
    <Progress value={comments.ratio * 100} color={color.accentSlate} />
    <StatRow label="Ratio" value={pct(comments.ratio)} />
    <StatRow label="Comment lines" value={comments.commentLines} />
    <StatRow label="Source lines" value={comments.sourceLines} />
  </StatCard>
);
