import { useFocusClient } from '@/app/hooks/use-focus-client';
import { useScoutClient } from '@/app/hooks/use-scout-client';
import { useStatusClient } from '@/app/hooks/use-status-client';
import { type PairingInfo, fetchPairingInfo } from '@/app/services/pairing-api';
import { fetchConfig } from '@/app/services/system';
import { useEffect, useState } from 'react';
import { ScoutCard } from './scout/scout-card';
import { ScoutTrigger } from './scout/scout-trigger';

const DEFAULT_ROUTE = '/paper-camp';

export interface ToolbarProps {
  route?: string;
  origin?: string;
}

// Same link shape the `dev`/`daemon` banners print, with this app's own proxied
// runtime origin standing in for the CLI's localhost/network address.
function hostedClientLink(pairing: PairingInfo, runtimeUrl: string, path: string): string {
  const params = new URLSearchParams({ runtime: runtimeUrl, token: pairing.token });
  return `${pairing.hostedClientUrl}${path}?${params}`;
}

export const Toolbar = ({ route: injectedRoute, origin }: ToolbarProps) => {
  const status = useStatusClient();
  const focusPlan = useFocusClient();
  const scout = useScoutClient();
  const [route, setRoute] = useState(injectedRoute ?? DEFAULT_ROUTE);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);

  useEffect(() => {
    fetchConfig().then((config) => {
      const configuredRoute = config?.integration?.route;
      if (configuredRoute) setRoute(configuredRoute);
    });
    fetchPairingInfo().then(setPairing);
  }, []);

  const runtimeUrl = `${origin ?? window.location.origin}${route}`;
  const deskPath = focusPlan ? `/plans/${encodeURIComponent(focusPlan.title)}` : '/';
  const deskUrl = pairing ? hostedClientLink(pairing, runtimeUrl, deskPath) : null;
  const changesUrl = pairing ? hostedClientLink(pairing, runtimeUrl, '/diff') : null;

  return (
    <ScoutTrigger>
      <ScoutCard
        status={status}
        focusPlan={focusPlan}
        openQuestions={scout.openQuestions}
        onRefreshScout={scout.refresh}
        deskUrl={deskUrl}
        changesUrl={changesUrl}
      />
    </ScoutTrigger>
  );
};
