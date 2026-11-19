import { NEXT_PATH } from '@/next/entry-path';
import { runtimeAdditionUrl } from './hub';
import type { RuntimeConnection } from './runtime-connection';

export function deskUrl(
  deskPath: string,
  mountPrefix: string,
  connection: Pick<RuntimeConnection, 'runtimeUrl' | 'pairingToken'>,
): string {
  const path = `${mountPrefix}${deskPath}`;
  return connection.runtimeUrl
    ? runtimeAdditionUrl(path, connection.runtimeUrl, connection.pairingToken)
    : path;
}

export const NEXT_DESK_PATH = `${NEXT_PATH}/`;

export const CLASSIC_DESK_PATH = '/';
