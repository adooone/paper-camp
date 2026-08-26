import { color } from '@/app/styles/tokens';
import { Progress } from '@dendelion/paper-ui';
import { StatCard, StatRow } from './stat-card';

export interface TestCoverageCardProps {
  testCoveragePct: number | null;
}

export const TestCoverageCard = ({ testCoveragePct }: TestCoverageCardProps) => (
  <StatCard title="Test coverage">
    {testCoveragePct === null ? (
      <p className="opacity-50 m-0">Run `pnpm test` to generate a coverage report.</p>
    ) : (
      <>
        <Progress value={testCoveragePct} color={color.accentGreen} />
        <StatRow label="Line coverage" value={`${Math.round(testCoveragePct)}%`} />
      </>
    )}
  </StatCard>
);
