import { useHubMachines } from '@/app/features/hub';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import { runtimeConnection } from '@/app/services/runtime-connection';
import { Button, CheckIcon, ChevronRightIcon, Menu, type MenuEntry } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { HUB_PATH } from './nav';
import { ProjectIdentityHeader } from './project-identity-header';

function rowLabel(row: HubProjectRow): string {
  return row.label ?? row.slug;
}

function machineAsleep(machine: HubMachine): boolean {
  return machine.reach === 'waiting' || machine.reach === 'unreachable';
}

export const ProjectSwitcherMenu = () => {
  const navigate = useNavigate();
  const { machines, chosenRuntimeUrls, openRow } = useHubMachines();

  const groups = machines
    .map((machine) => ({
      machine,
      rows: machine.projects
        .filter((row) => chosenRuntimeUrls.has(row.runtimeUrl))
        .sort((a, b) => rowLabel(a).localeCompare(rowLabel(b))),
    }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => a.machine.host.localeCompare(b.machine.host));

  const showHostHeadings = groups.length > 1;

  const items: MenuEntry[] = groups.flatMap(({ machine, rows }) => {
    const asleep = machineAsleep(machine);
    const heading: MenuEntry[] = showHostHeadings
      ? [
          {
            id: `host-${machine.machineUrl}`,
            label: <span className="font-handwritten text-xs opacity-60">{machine.host}</span>,
            disabled: true,
          },
        ]
      : [];
    return [
      ...heading,
      ...rows.map((row): MenuEntry => {
        const current = row.runtimeUrl === runtimeConnection.runtimeUrl;
        return {
          id: row.runtimeUrl,
          icon: current ? <CheckIcon size={14} /> : <span className="inline-block w-[14px]" />,
          disabled: asleep,
          label: (
            <span className="flex items-baseline gap-2">
              <span>{rowLabel(row)}</span>
              {asleep ? (
                <span className="opacity-60">asleep</span>
              ) : row.stamp.kind === 'running' ? (
                <span className="opacity-60">running</span>
              ) : null}
            </span>
          ),
          onSelect: asleep ? undefined : () => openRow(row, machine.machineUrl),
        };
      }),
    ];
  });

  items.push({ id: 'switcher-separator', type: 'separator' });
  items.push({
    id: 'add-machine',
    label: 'Add a machine',
    onSelect: () => navigate({ to: HUB_PATH }),
  });

  return (
    <Menu
      trigger={
        <Button variant="ghost" size="small" className="flex items-center gap-1 min-w-0">
          <ProjectIdentityHeader size="sm" />
          <span className="inline-flex rotate-90 opacity-60 shrink-0">
            <ChevronRightIcon size={12} />
          </span>
        </Button>
      }
      items={items}
    />
  );
};
