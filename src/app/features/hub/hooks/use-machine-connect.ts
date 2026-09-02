import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useState } from 'react';

function normalizeMachineUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export interface UseMachineConnectResult {
  machineUrl: string;
  setMachineUrl: (value: string) => void;
  connectedUrl: string;
  projects: MachineProjectSummary[] | null;
  loading: boolean;
  error: string | null;
  connect: () => void;
}

export function useMachineConnect(): UseMachineConnectResult {
  const [machineUrl, setUrl] = useState('');
  const [connectedUrl, setConnectedUrl] = useState('');
  const [projects, setProjects] = useState<MachineProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMachineUrl = (value: string) => {
    setUrl(value);
    setProjects(null);
    setError(null);
  };

  const connect = () => {
    const url = normalizeMachineUrl(machineUrl);
    if (url === '') return;
    setLoading(true);
    setError(null);
    fetchMachineProjects(url)
      .then((result) => {
        if (!result || result.length === 0) {
          setError('No projects found there — is paper-camp daemon running on that address?');
          return;
        }
        setConnectedUrl(url);
        setProjects(result);
      })
      .finally(() => setLoading(false));
  };

  return { machineUrl, setMachineUrl, connectedUrl, projects, loading, error, connect };
}
