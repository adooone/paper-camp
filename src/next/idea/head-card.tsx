import type { EntityDetailEntry, PlanStatus } from '@/types/index';
import { formatProgress, ideaStatusMeaning } from '../shell/idea-model';
import { STATUS_LABEL } from '../shell/ideas-model';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { Stamp } from '../ui/stamp';
import styles from './idea.module.css';

interface HeadCardProps {
  idea: EntityDetailEntry;
  status: PlanStatus;
  activeIndex: number | null;
}

export function HeadCard({ idea, status, activeIndex }: HeadCardProps) {
  const done = idea.phases.filter((phase) => phase.done).length;
  const active = activeIndex == null ? undefined : idea.phases[activeIndex];
  return (
    <KraftCard className={styles.headCard}>
      <div className={styles.headTop}>
        <div className={styles.headId}>
          <Hand size="xs" color="inkFaint">
            {idea.id}
          </Hand>
          {idea.type ? <Stamp meaning="idle">{idea.type}</Stamp> : null}
        </div>
        <Stamp meaning={ideaStatusMeaning(status)}>{STATUS_LABEL[status]}</Stamp>
      </div>
      <Hand as="h2" size="xl" bold>
        {idea.title}
      </Hand>
      <Hand size="md" color="inkSoft">
        {formatProgress(done, idea.phases.length)}
      </Hand>
      {active && activeIndex != null ? (
        <Hand size="sm" color="inkSoft">
          {`Working on phase ${activeIndex + 1}: ${active.text}`}
        </Hand>
      ) : null}
    </KraftCard>
  );
}
