import { RefreshIcon } from '@/app/components/icons';
import { pickableTailnetPeers, runtimeAdditionUrl } from '@/app/services/hub';
import type { TailnetPeerRuntime } from '@/types/index';
import { Card, IconButton, ListItem } from '@dendelion/paper-ui';
import { useTailnetPeers } from '../hooks';

function addPeer(peer: TailnetPeerRuntime): void {
  window.location.assign(runtimeAdditionUrl(window.location.pathname, peer.runtimeUrl));
}

export interface TailnetPeersCardProps {
  chosenRuntimeUrls: string[];
}

export const TailnetPeersCard = ({ chosenRuntimeUrls }: TailnetPeersCardProps) => {
  const { peers, loading, refresh } = useTailnetPeers();
  if (peers.length === 0) return null;

  const pickable = pickableTailnetPeers(peers, chosenRuntimeUrls);

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 font-semibold">Tailnet</p>
        <IconButton
          icon={<RefreshIcon size={16} />}
          label={loading ? 'Refreshing…' : 'Refresh'}
          size="small"
          variant="ghost"
          disabled={loading}
          onClick={refresh}
        />
      </div>
      {pickable.length === 0 ? (
        <p className="m-0 text-sm opacity-70">Every discovered runtime is already added.</p>
      ) : (
        <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
          {pickable.map((peer) => (
            <ListItem
              key={peer.runtimeUrl}
              size="small"
              className="min-w-0"
              onClick={() => addPeer(peer)}
            >
              <span className="flex min-w-0 flex-col gap-0.5 text-left">
                <span className="truncate">{peer.dnsName}</span>
                {peer.version && (
                  <span className="font-handwritten text-2xs opacity-60">v{peer.version}</span>
                )}
              </span>
            </ListItem>
          ))}
        </div>
      )}
    </Card>
  );
};
