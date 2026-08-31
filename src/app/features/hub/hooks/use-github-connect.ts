import {
  pollGithubDeviceToken,
  startGithubDeviceFlow,
} from '@/app/services/github-device-flow-api';
import { GithubApiError } from '@/app/services/github/client';
import {
  clearHubGithubToken,
  readHubGithubToken,
  writeHubGithubToken,
} from '@/app/services/github/hub-token-store';
import {
  type GithubIdentity,
  fetchAccessibleRepoNames,
  fetchGithubIdentity,
} from '@/app/services/github/identity';
import { useEffect, useRef, useState } from 'react';

export interface GithubConnection {
  identity: GithubIdentity;
  repoNames: string[];
}

export interface DeviceFlowState {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
}

async function connect(token: string): Promise<GithubConnection> {
  const [identity, repoNames] = await Promise.all([
    fetchGithubIdentity(token),
    fetchAccessibleRepoNames(token),
  ]);
  return { identity, repoNames };
}

function connectErrorMessage(error: unknown): string {
  if (error instanceof GithubApiError) return error.message;
  return 'Could not reach GitHub.';
}

export interface UseGithubConnectResult {
  connection: GithubConnection | null;
  loading: boolean;
  error: string | null;
  deviceFlow: DeviceFlowState | null;
  deviceFlowLoading: boolean;
  token: string;
  setToken: (token: string) => void;
  connectWithToken: () => void;
  disconnect: () => void;
  signIn: () => void;
  cancelDeviceFlow: () => void;
}

export function useGithubConnect(): UseGithubConnectResult {
  const [token, setToken] = useState('');
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);
  const [deviceFlowLoading, setDeviceFlowLoading] = useState(false);
  const activeDeviceCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = readHubGithubToken();
    if (!stored) return;
    setLoading(true);
    connect(stored)
      .then((next) => setConnection(next))
      .catch(() => {
        clearHubGithubToken();
        setError('That token no longer works — reconnect below.');
      })
      .finally(() => setLoading(false));
  }, []);

  const connectWithToken = () => {
    const trimmedToken = token.trim();
    if (trimmedToken === '') return;
    setLoading(true);
    setError(null);
    connect(trimmedToken)
      .then((next) => {
        writeHubGithubToken(trimmedToken);
        setConnection(next);
        setToken('');
        setDeviceFlow(null);
      })
      .catch((connectError) => setError(connectErrorMessage(connectError)))
      .finally(() => setLoading(false));
  };

  const disconnect = () => {
    clearHubGithubToken();
    setConnection(null);
    setError(null);
  };

  const pollDeviceToken = async (deviceCode: string, intervalSeconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    if (activeDeviceCodeRef.current !== deviceCode) return;
    const result = await pollGithubDeviceToken(deviceCode);
    if (activeDeviceCodeRef.current !== deviceCode) return;

    if (result.access_token) {
      activeDeviceCodeRef.current = null;
      writeHubGithubToken(result.access_token);
      try {
        setConnection(await connect(result.access_token));
      } catch (connectError) {
        setError(connectErrorMessage(connectError));
      }
      setDeviceFlow(null);
      return;
    }
    if (result.error === 'authorization_pending') {
      await pollDeviceToken(deviceCode, intervalSeconds);
      return;
    }
    if (result.error === 'slow_down') {
      await pollDeviceToken(deviceCode, result.interval ?? intervalSeconds + 5);
      return;
    }

    activeDeviceCodeRef.current = null;
    setDeviceFlow(null);
    setError(result.error_description ?? 'GitHub sign-in did not complete.');
  };

  const signIn = () => {
    setDeviceFlowLoading(true);
    setError(null);
    startGithubDeviceFlow()
      .then((code) => {
        activeDeviceCodeRef.current = code.device_code;
        window.open(code.verification_uri, '_blank', 'noopener,noreferrer');
        setDeviceFlow({
          userCode: code.user_code,
          deviceCode: code.device_code,
          verificationUri: code.verification_uri,
        });
        pollDeviceToken(code.device_code, code.interval);
      })
      .catch(() => setError('Could not reach GitHub.'))
      .finally(() => setDeviceFlowLoading(false));
  };

  const cancelDeviceFlow = () => {
    activeDeviceCodeRef.current = null;
    setDeviceFlow(null);
    setError(null);
  };

  return {
    connection,
    loading,
    error,
    deviceFlow,
    deviceFlowLoading,
    token,
    setToken,
    connectWithToken,
    disconnect,
    signIn,
    cancelDeviceFlow,
  };
}
