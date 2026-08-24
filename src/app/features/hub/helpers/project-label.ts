import { runtimeRowLabel } from '@/app/services/hub';
import type { RuntimeConnection } from '@/app/services/runtime-connection';

export function projectLabel(runtime: RuntimeConnection): string {
  return runtime.label ?? runtimeRowLabel(runtime.runtimeUrl);
}
