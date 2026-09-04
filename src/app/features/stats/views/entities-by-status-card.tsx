import { EmptyState } from '@/app/components';
import type { ProjectStats } from '@/types/index';
import { ENTITY_STATUS_LABEL, ENTITY_STATUS_ORDER } from '../constants';
import { StatCard, StatRow } from './stat-card';

export interface EntitiesByStatusCardProps {
  entitiesByStatus: ProjectStats['entitiesByStatus'];
}

export const EntitiesByStatusCard = ({ entitiesByStatus }: EntitiesByStatusCardProps) => (
  <StatCard title="Entities by status">
    {ENTITY_STATUS_ORDER.filter((status) => entitiesByStatus[status]).map((status) => (
      <StatRow key={status} label={ENTITY_STATUS_LABEL[status]} value={entitiesByStatus[status]} />
    ))}
    {Object.keys(entitiesByStatus).length === 0 && <EmptyState message="No entities yet." />}
  </StatCard>
);
