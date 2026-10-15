import { resolveCurrentProject } from '@/app/features/scope/current-project';
import { useProjectIdentity } from '@/app/hooks';
import { runtimeConnection } from '@/app/services/runtime-connection';
import { Button, Page, PageTitle } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { AddMachineFooter } from '../components';
import { useHubMachines } from '../hooks';

export const HubHome = () => {
  const navigate = useNavigate();
  const { machines } = useHubMachines();
  const { projectName } = useProjectIdentity();
  const currentRuntimeUrl = runtimeConnection.runtimeUrl;
  const current = currentRuntimeUrl
    ? resolveCurrentProject(machines, currentRuntimeUrl, projectName ?? 'this project')
    : null;

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
      <AddMachineFooter />
      {current && (
        <Button variant="ghost" size="small" onClick={() => navigate({ to: '/' })}>
          Back to {current.project.label ?? current.project.slug}
        </Button>
      )}
    </Page>
  );
};
