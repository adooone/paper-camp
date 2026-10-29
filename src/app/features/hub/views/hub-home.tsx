import { resolveCurrentProject } from '@/app/features/scope/current-project';
import { useProjectIdentity } from '@/app/hooks';
import { totalLocalStateDrift } from '@/app/services/hub-machines';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { Button, Page, PageTitle, Stamp } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { AddMachineFooter } from '../components';
import { useHubMachines } from '../hooks';

export const HubHome = () => {
  const navigate = useNavigate();
  const { machines } = useHubMachines();
  const { projectName } = useProjectIdentity();
  const { runtimeUrl: currentRuntimeUrl } = useRuntimeConnection();
  const current = currentRuntimeUrl
    ? resolveCurrentProject(machines, currentRuntimeUrl, projectName ?? 'this project')
    : null;
  const driftTotal = totalLocalStateDrift(machines);

  return (
    <Page
      texture={{ texture: 'parchment' }}
      outline
      className="w-full max-w-md mx-auto flex flex-col gap-4"
    >
      <PageTitle className="flex items-center gap-2">
        <img src="/img/paper-logo.svg" alt="" className="h-[1cap]" />
        Paper Camp
      </PageTitle>
      {driftTotal > 0 && (
        <Stamp size="small" variant="warning">
          {driftTotal} local-state drift across all projects
        </Stamp>
      )}
      <AddMachineFooter />
      {current && (
        <Button variant="ghost" size="small" onClick={() => navigate({ to: '/' })}>
          Back to {current.project.label ?? current.project.slug}
        </Button>
      )}
    </Page>
  );
};
