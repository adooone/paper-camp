import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHubMachines } from '@/app/features/hub/hooks/use-hub-machines';
import { listMachines, removeMachine } from '@/app/services/machine-store';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchConfig, saveConfig } from '@/app/services/system';
import type {
  AgentConfig,
  DefaultAgentKey,
  NotificationSettingKind,
  PaperCampConfig,
} from '@/types/index';
import { notificationKinds, type PushPermission, resolvedAgents } from '../shell/settings-model';
import { useProjectName } from './use-project-name';

export type ConfigLoad =
  | { status: 'loading' }
  | { status: 'ready'; config: PaperCampConfig }
  | { status: 'error' };

export interface SettingsMachine {
  url: string;
  host: string;
  version: string | null;
  pairedHere: boolean;
}

export interface SettingsScreenState {
  projectName: string | null;
  load: ConfigLoad;
  permission: PushPermission;
  kinds: Record<NotificationSettingKind, boolean> | null;
  agents: ReturnType<typeof resolvedAgents> | null;
  pendingKind: NotificationSettingKind | null;
  saveError: string | null;
  machines: SettingsMachine[];
  reload: () => Promise<void>;
  toggleKind: (kind: NotificationSettingKind) => Promise<void>;
  saveAgent: (role: DefaultAgentKey, next: AgentConfig) => Promise<string | null>;
  unpair: (machine: SettingsMachine) => void;
}

const readPermission = (): PushPermission =>
  typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window
    ? Notification.permission
    : 'unsupported';

export function useSettingsScreen(): SettingsScreenState {
  const projectName = useProjectName();
  const { runtimeUrl } = useRuntimeConnection();
  const { machines: hubMachines } = useHubMachines();
  const [load, setLoad] = useState<ConfigLoad>({ status: 'loading' });
  const [pendingKind, setPendingKind] = useState<NotificationSettingKind | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unpaired, setUnpaired] = useState<string[]>([]);
  const [permission] = useState(readPermission);

  const reload = useCallback(async () => {
    const config = await fetchConfig();
    setLoad(config ? { status: 'ready', config } : { status: 'error' });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a different runtime is the trigger to reload, not a value the body reads.
  useEffect(() => {
    setLoad({ status: 'loading' });
    void reload();
  }, [runtimeUrl, reload]);

  const config = load.status === 'ready' ? load.config : null;
  const kinds = useMemo(() => (config ? notificationKinds(config) : null), [config]);
  const agents = useMemo(() => (config ? resolvedAgents(config) : null), [config]);

  const toggleKind = useCallback(
    async (kind: NotificationSettingKind) => {
      if (!kinds) return;
      setPendingKind(kind);
      setSaveError(null);
      const result = await saveConfig({
        notifications: { kinds: { ...kinds, [kind]: !kinds[kind] } },
      });
      if (result.ok) await reload();
      else setSaveError(result.error ?? "Couldn't save the change.");
      setPendingKind(null);
    },
    [kinds, reload],
  );

  const saveAgent = useCallback(
    async (role: DefaultAgentKey, next: AgentConfig) => {
      if (!agents) return null;
      const result = await saveConfig({ defaultAgents: { ...agents, [role]: next } });
      if (!result.ok) return result.error ?? 'The daemon rejected the change.';
      await reload();
      return null;
    },
    [agents, reload],
  );

  const machines = useMemo(() => {
    const paired = listMachines();
    return hubMachines
      .filter((machine) => !unpaired.includes(machine.machineUrl))
      .map((machine) => ({
        url: machine.machineUrl,
        host: machine.host,
        version: machine.runtimeVersion,
        pairedHere: paired.includes(machine.machineUrl),
      }));
  }, [hubMachines, unpaired]);

  const unpair = useCallback((machine: SettingsMachine) => {
    removeMachine(machine.url);
    setUnpaired((current) => [...current, machine.url]);
  }, []);

  return {
    projectName,
    load,
    permission,
    kinds,
    agents,
    pendingKind,
    saveError,
    machines,
    reload,
    toggleKind,
    saveAgent,
    unpair,
  };
}
