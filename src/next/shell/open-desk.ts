import { deskUrl } from '@/app/services/desk-links';
import { mountPrefix } from '@/app/services/mount';
import { getRuntimeConnection } from '@/app/services/runtime-connection';

export const openDesk = (deskPath: string): void =>
  window.location.assign(deskUrl(deskPath, mountPrefix, getRuntimeConnection()));
