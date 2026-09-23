import { SignInAction } from '@/app/components/sign-in-action';
import type { ConnectionResult } from '@/types/index';
import { IconButton, RefreshIcon, Stamp, Tooltip } from '@dendelion/paper-ui';
import { CAPABILITY_STATUS_STAMP } from '../constants';
import { ConnectActionView } from './connect-action-view';
import { SettingRow } from './setting-row';

// Only claude-code exposes `auth login`/`auth status` (see agentAuthenticated in server/services.ts).
const RELAY_CONNECTION_ID: ConnectionResult['id'] = 'agent:claude-code';

interface ConnectionRowProps {
  connection: ConnectionResult;
  onRecheck: (id: string) => void;
  rechecking: boolean;
  onConnect: (id: string) => void;
  connecting: boolean;
}

export const ConnectionRow = ({
  connection,
  onRecheck,
  rechecking,
  onConnect,
  connecting,
}: ConnectionRowProps) => {
  const stamp = CAPABILITY_STATUS_STAMP[connection.status];
  const healthy = connection.status === 'ok';

  const recheckButton = (
    <IconButton
      icon={<RefreshIcon size={14} />}
      label={rechecking ? 'Checking…' : 'Recheck'}
      size="small"
      variant="ghost"
      disabled={rechecking}
      onClick={() => onRecheck(connection.id)}
    />
  );

  if (healthy) {
    return (
      <SettingRow label={connection.label}>
        <div className="flex items-center gap-1.5">
          <Tooltip content={connection.detail}>
            <Stamp size="small" fillColor={stamp.fill} textColor={stamp.text}>
              {stamp.label}
            </Stamp>
          </Tooltip>
          {recheckButton}
        </div>
      </SettingRow>
    );
  }

  return (
    <SettingRow
      label={connection.label}
      hint={
        <>
          <div>Unlocks: {connection.unlocks}</div>
          {connection.detail && <div>{connection.detail}</div>}
        </>
      }
    >
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
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
          {recheckButton}
        </div>
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
    </SettingRow>
  );
};
