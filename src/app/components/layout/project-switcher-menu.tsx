import { useHubMachines } from '@/app/features/hub';
import { useProjectIdentity } from '@/app/hooks';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { startMachineBatch } from '@/app/services/system';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import {
  Button,
  CheckIcon,
  ChevronRightIcon,
  Menu,
  type MenuEntry,
  RunIcon,
  useToast,
} from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { HUB_PATH } from './nav';

function rowLabel(row: HubProjectRow): string {
  return row.label ?? row.slug;
}

function machineAsleep(machine: HubMachine): boolean {
  return machine.reach === 'waiting' || machine.reach === 'unreachable';
}

export const ProjectSwitcherMenu = () => {
  const navigate = useNavigate();
  const { machines, openRow } = useHubMachines();
  const { projectName, nameLoading } = useProjectIdentity();
  const { runtimeUrl: currentRuntimeUrl } = useRuntimeConnection();
  const { toast } = useToast();

  const groups = machines
    .map((machine) => ({
      machine,
      // Every project the machine serves, not only the ones this browser opened before.
      rows: [...machine.projects].sort((a, b) => rowLabel(a).localeCompare(rowLabel(b))),
    }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => a.machine.host.localeCompare(b.machine.host));

  const showHostHeadings = groups.length > 1;

  const handleRunAllQueues = async (machine: HubMachine, rows: HubProjectRow[]) => {
    const result = await startMachineBatch(
      machine.machineUrl,
      rows.map((row) => row.slug),
    );
    if (!result.ok) {
      toast({
        title: 'Failed to start',
        description: oneLineErrorSummary(result.error ?? 'Unknown error'),
        variant: 'error',
      });
      return;
    }
    toast({ title: `Running ${rows.length} project queue(s) on ${machine.host}` });
  };

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
    const runAllQueues: MenuEntry[] = [
      {
        id: `run-all-queues-${machine.machineUrl}`,
        icon: <RunIcon size={14} />,
        label: 'Run all queues…',
        disabled: asleep,
        onSelect: asleep ? undefined : () => handleRunAllQueues(machine, rows),
      },
    ];
    return [
      ...heading,
      ...runAllQueues,
      ...rows.map((row): MenuEntry => {
        const current = row.runtimeUrl === currentRuntimeUrl;
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
        <Button variant="ghost" size="small" className="min-w-0">
          <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
            <span className="truncate pr-1 font-handwritten text-base leading-normal">
              {nameLoading ? 'Loading…' : (projectName ?? 'Choose a project')}
            </span>
            <span className="inline-flex shrink-0 rotate-90 opacity-60">
              <ChevronRightIcon size={12} />
            </span>
          </span>
        </Button>
      }
      items={items}
    />
  );
};
