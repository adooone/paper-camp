import { StatCard, StatRow } from './stat-card';

export interface CodebaseSizeCardProps {
  sourceLines: number;
  testLines: number;
}

export const CodebaseSizeCard = ({ sourceLines, testLines }: CodebaseSizeCardProps) => (
  <StatCard title="Codebase size">
    <StatRow label="Source lines" value={sourceLines} />
    <StatRow label="Test lines" value={testLines} />
  </StatCard>
);
