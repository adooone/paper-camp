import { useAppStore } from '@/app/stores/app-store';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';

const RELAY_POLL_MS = 2000;

export const useSignInAction = (onSignedIn: () => void) => {
  const loginRelay = useAppStore((s) => s.loginRelay);
  const startLoginRelay = useAppStore((s) => s.startLoginRelay);
  const loadLoginRelayStatus = useAppStore((s) => s.loadLoginRelayStatus);
  const cancelLoginRelay = useAppStore((s) => s.cancelLoginRelay);
  const { toast } = useToast();
  const openedUrlRef = useRef<string | null>(null);
  const phase = loginRelay?.phase;

  useEffect(() => {
    if (phase !== 'starting' && phase !== 'awaiting-authorization') return;
    const id = window.setInterval(() => loadLoginRelayStatus(), RELAY_POLL_MS);
    return () => window.clearInterval(id);
  }, [phase, loadLoginRelayStatus]);

  useEffect(() => {
    const url = loginRelay?.authorizeUrl;
    if (phase !== 'awaiting-authorization' || !url || openedUrlRef.current === url) return;
    openedUrlRef.current = url;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [phase, loginRelay?.authorizeUrl]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on phase transitions only — toast/onSignedIn aren't stable across renders, and including them would refire on every relay poll
  useEffect(() => {
    if (phase === 'success') {
      toast({ title: 'Signed in', variant: 'success' });
      onSignedIn();
    } else if (phase === 'error') {
      toast({ title: 'Sign-in failed', description: loginRelay?.error, variant: 'error' });
    }
  }, [phase]);

  return {
    phase,
    authorizeUrl: loginRelay?.authorizeUrl,
    startLoginRelay,
    cancelLoginRelay,
  };
};
