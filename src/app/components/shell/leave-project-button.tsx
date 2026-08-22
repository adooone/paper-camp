import { mountPrefix } from '@/app/services/mount';
import { leaveActiveRuntime, runtimeConnection } from '@/app/services/runtime-connection';
import { Button } from '@dendelion/paper-ui';

function leaveProject(): void {
  leaveActiveRuntime(window.localStorage);
  window.location.assign(window.location.pathname);
}

export const LeaveProjectButton = () => {
  if (mountPrefix !== '' || runtimeConnection.runtimeUrl === '') return null;
  return (
    <Button variant="ghost" size="small" onClick={leaveProject}>
      Back to projects
    </Button>
  );
};
