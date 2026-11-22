import { useNavigate } from '@tanstack/react-router';
import { DeskProposalModal } from '@/app/components/stack-panel/desk-proposal-modal';
import { useDeskSection } from '@/app/features/settings/hooks/use-desk-section';
import { useProjectName } from '../hooks/use-project-name';
import { CiCard } from '../settings/ci-card';
import { CheckTable, ServiceTable } from '../settings/desk-tables';
import styles from '../settings/settings.module.css';
import { BackHeader } from '../shell/back-header';
import { SCREEN_PATHS } from '../shell/screens';
import { discoverLabel } from '../shell/settings-model';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { ListLabel } from '../ui/list';
import { SkeletonRows } from '../ui/skeleton-rows';

export const DeskSetupPage = () => {
  const desk = useDeskSection();
  const projectName = useProjectName();
  const navigate = useNavigate();
  const { config } = desk;

  return (
    <div className={styles.page}>
      <BackHeader
        onBack={() => void navigate({ to: SCREEN_PATHS.settings })}
        label={projectName ?? 'Desk'}
      />
      {config === undefined ? <SkeletonRows /> : null}
      {config === null ? (
        <EmptyState
          title="No config yet"
          line="Run paper-camp init in this project's directory first."
        />
      ) : null}
      {config ? (
        <>
          <div className={styles.toolbar}>
            <Button
              label={discoverLabel(desk.discovering, Boolean(config.desk))}
              variant="secondary"
              size="sm"
              disabled={desk.discovering}
              onPress={() => void desk.startDiscovery()}
            />
          </div>

          <div className={styles.list}>
            <ListLabel
              trailing={
                <Button label="+ Add" variant="ghost" size="xs" onPress={desk.addService} />
              }
            >
              Services
            </ListLabel>
            <KraftCard padding={0}>
              {desk.services.length === 0 ? (
                <div className={styles.note}>
                  <Hand size="sm" color="inkSoft">
                    No services yet.
                  </Hand>
                </div>
              ) : (
                <ServiceTable
                  rows={desk.services}
                  onSave={desk.updateService}
                  onRemove={desk.removeService}
                />
              )}
            </KraftCard>
          </div>

          <div className={styles.list}>
            <ListLabel
              trailing={<Button label="+ Add" variant="ghost" size="xs" onPress={desk.addCheck} />}
            >
              Checks
            </ListLabel>
            <KraftCard padding={0}>
              {desk.checks.length === 0 ? (
                <div className={styles.note}>
                  <Hand size="sm" color="inkSoft">
                    No checks yet.
                  </Hand>
                </div>
              ) : (
                <CheckTable
                  rows={desk.checks}
                  onSave={desk.updateCheck}
                  onRemove={desk.removeCheck}
                />
              )}
            </KraftCard>
          </div>

          <div className={styles.list}>
            <ListLabel>CI</ListLabel>
            <CiCard ci={desk.ci} onSave={desk.updateCi} />
          </div>

          {desk.proposal && desk.diff ? (
            <DeskProposalModal
              current={config.desk}
              proposal={desk.proposal}
              diff={desk.diff}
              onApply={desk.applyProposal}
              onCancel={desk.cancelProposal}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
};
