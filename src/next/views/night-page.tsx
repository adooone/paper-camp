import { useNavigate } from '@tanstack/react-router';
import { useNightReport } from '@/app/hooks/use-night-report';
import { useProjectName } from '../hooks/use-project-name';
import { ChunkTable } from '../night/chunk-table';
import styles from '../night/night.module.css';
import { BackHeader } from '../shell/back-header';
import { chunkRows, NIGHT_EMPTY, reportSummary } from '../shell/night-model';
import { SCREEN_PATHS } from '../shell/screens';
import { EmptyState } from '../ui/empty-state';
import { KraftCard } from '../ui/kraft-card';
import { ListLabel } from '../ui/list';
import { Stamp } from '../ui/stamp';

export const NightPage = () => {
  const groups = useNightReport();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const group = groups[0];
  const rows = group ? chunkRows(group.findings) : [];

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.projects })}
        label={projectName ?? 'Night report'}
      />
      <div className={styles.content}>
        {group && rows.length > 0 ? (
          <div className={styles.group}>
            <ListLabel trailing={<Stamp meaning="parked">{String(group.findings.length)}</Stamp>}>
              Review findings · {reportSummary(group)}
            </ListLabel>
            <KraftCard padding={0}>
              <ChunkTable rows={rows} />
            </KraftCard>
          </div>
        ) : (
          <EmptyState title={NIGHT_EMPTY.title} line={NIGHT_EMPTY.line} />
        )}
      </div>
    </div>
  );
};
