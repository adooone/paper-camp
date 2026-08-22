import { useRuntimeStatuses } from '@/app/features/hub/use-runtime-statuses';
import { runtimeRowLabel } from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import { listRuntimes, runtimeConnection, selectRuntime } from '@/app/services/runtime-connection';
import { Button, FolderIcon, Menu, type MenuEntry } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRightIcon } from '../icons';
import { ProjectIdentityHeader } from './project-identity-header';

// A full load, not a client navigation: switching runtimes repoints the API base
// set once at startup, same as choosing a project from the hub's own list.
function switchTo(runtimeUrl: string): void {
  selectRuntime(runtimeUrl, window.localStorage);
  window.location.assign(mountPrefix || '/');
}

export const ProjectSwitcher = () => {
  const navigate = useNavigate();
  const storage = typeof window === 'undefined' ? null : window.localStorage;
  const registered = mountPrefix === '' ? listRuntimes(storage) : [];
  const others = registered.filter(
    (runtime) => runtime.runtimeUrl !== runtimeConnection.runtimeUrl,
  );
  const statuses = useRuntimeStatuses(others);

  // Embedded under a mount prefix there is no hub to switch through: the host
  // app decides which project this is.
  if (mountPrefix !== '') return <ProjectIdentityHeader size="sm" />;

  const items: MenuEntry[] = [
    ...others.map((runtime) => ({
      id: runtime.runtimeUrl,
      label:
        runtime.label ?? statuses[runtime.runtimeUrl]?.name ?? runtimeRowLabel(runtime.runtimeUrl),
      icon: <FolderIcon size={16} />,
      onSelect: () => switchTo(runtime.runtimeUrl),
    })),
    ...(others.length > 0 ? [{ id: 'separator', type: 'separator' as const }] : []),
    {
      id: 'all-projects',
      label: 'All projects',
      onSelect: () => navigate({ to: '/projects' }),
    },
  ];

  return (
    <Menu
      trigger={
        <Button variant="ghost" size="small" className="min-w-0 gap-1.5">
          <ProjectIdentityHeader size="sm" />
          <span className="rotate-90 opacity-60 shrink-0">
            <ChevronRightIcon size={12} />
          </span>
        </Button>
      }
      items={items}
    />
  );
};
