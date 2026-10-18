import type { ServiceState } from '../types/index';

export type ServiceTone = 'muted' | 'running' | 'pass' | 'fail';

export interface ServiceStatus {
  word: string;
  tone: ServiceTone;
}

export const SERVICE_DOT_CLASS: Record<ServiceTone, string> = {
  muted: 'bg-desk-text-muted',
  running: 'bg-chalk-running-text',
  pass: 'bg-chalk-pass-text',
  fail: 'bg-chalk-fail-text',
};

export function serviceStatus(service: ServiceState): ServiceStatus {
  switch (service.status) {
    case 'stopped':
      return { word: 'stopped', tone: 'muted' };
    case 'stopping':
      return { word: 'stopping', tone: 'running' };
    case 'crashed':
      return {
        word: service.exitCode === null ? 'crashed' : `crashed · exit ${service.exitCode}`,
        tone: 'fail',
      };
    case 'running':
      if (service.pid === null) return { word: 'external', tone: 'pass' };
      if (service.health === 'down') return { word: 'unhealthy', tone: 'fail' };
      if (service.hasHealthcheck && service.health === 'unknown') {
        return { word: 'starting', tone: 'running' };
      }
      return { word: 'running', tone: 'pass' };
  }
}
