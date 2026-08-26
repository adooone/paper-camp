import { StatCard, StatRow } from './stat-card';

export interface NotesCardProps {
  openQuestions: number;
  decisions: number;
}

export const NotesCard = ({ openQuestions, decisions }: NotesCardProps) => (
  <StatCard title="Notes">
    <StatRow label="Open questions" value={openQuestions} />
    <StatRow label="Decisions" value={decisions} />
  </StatCard>
);
