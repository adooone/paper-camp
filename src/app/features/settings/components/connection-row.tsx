import { SignInAction } from '@/app/components/sign-in-action';
import type { ConnectionResult } from '@/types/index';
import { Button, Divider, Stamp, Tooltip } from '@dendelion/paper-ui';
import { CAPABILITY_STATUS_STAMP } from '../constants';
import { ConnectActionView } from './connect-action-view';

// Only claude-code exposes `auth login`/`auth status` (see agentAuthenticated in server/services.ts).
const RELAY_CONNECTION_ID: ConnectionResult['id'] = 'agent:claude-code';

interface ConnectionRowProps {
  connection: ConnectionResult;
  isLast: boolean;
  onRecheck: (id: string) => void;
  rechecking: boolean;
  onConnect: (id: string) => void;
  connecting: boolean;
}

export const ConnectionRow = ({
  connection,
  isLast,
  onRecheck,
  rechecking,
  onConnect,
  connecting,
}: ConnectionRowProps) => {
  const stamp = CAPABILITY_STATUS_STAMP[connection.status];
  return (
    <>
      <div className="pb-3 pt-3">
        <div className="flex items-center gap-3">
          <span className="flex-1 font-medium">{connection.label}</span>
          {connection.authenticated === false && (
            <Tooltip content="Installed, but not signed in">
              <Stamp size="small" variant="warning">
                Not signed in
              </Stamp>
            </Tooltip>
          )}
          {connection.trustDialogAccepted === false && (
            <Tooltip content="Open `claude` in this repo once and accept its trust dialog">
              <Stamp size="small" variant="warning">
                Headless runs ignore this repo's permission allowlist
              </Stamp>
            </Tooltip>
          )}
          <Stamp size="small" fillColor={stamp.fill} textColor={stamp.text}>
            {stamp.label}
          </Stamp>
          <Button size="small" onClick={() => onRecheck(connection.id)} disabled={rechecking}>
            {rechecking ? 'Checking…' : 'Recheck'}
          </Button>
        </div>
        <p className="opacity-[0.65] text-sm mt-1 mx-0 mb-0">Unlocks: {connection.unlocks}</p>
        <p className="opacity-50 text-sm mt-1 mx-0 mb-0">{connection.detail}</p>
        <div className="mt-2">
          {connection.id === RELAY_CONNECTION_ID && connection.authenticated === false ? (
            <SignInAction onSignedIn={() => onRecheck(connection.id)} />
          ) : (
            <ConnectActionView
              connection={connection}
              onConnect={onConnect}
              connecting={connecting}
            />
          )}
        </div>
      </div>
      {!isLast && <Divider />}
    </>
  );
};
