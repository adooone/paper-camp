import { type ServicesClient, useServicesClient } from '@/app/hooks/use-services-client';
import { SERVICE_DOT_CLASS, serviceStatus } from '@/core/service-status';
import type { ServiceState } from '@/types/index';
import {
  Card,
  EmptyState,
  IconButton,
  RefreshIcon,
  RunIcon,
  Spinner,
  StopIcon,
  useToast,
} from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { groupLabelClassName } from './shared';

export const SERVICES_GROUP_LABEL = 'Services';

export type ServiceAction = 'start' | 'stop' | 'restart';

export const serviceActions = (service: ServiceState): ServiceAction[] => {
  if (service.status === 'stopped' || service.status === 'crashed') return ['start'];
  if (service.status === 'running' && service.pid !== null) return ['stop', 'restart'];
  return [];
};

const ACTION_ICONS: Record<ServiceAction, () => React.ReactNode> = {
  start: () => <RunIcon />,
  stop: () => <StopIcon />,
  restart: () => <RefreshIcon />,
};

const ServiceRow = ({ service, client }: { service: ServiceState; client: ServicesClient }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { word, tone } = serviceStatus(service);

  const runAction = (action: ServiceAction) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await client[action](service.name);
    } catch (err) {
      toast({
        title: `Failed to ${action} service`,
        description: (err as Error).message,
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    // Raw button: folk-ui has no full-width clickable row primitive.
    <button
      type="button"
      onClick={() =>
        navigate({ to: '/activity/services/$name', params: { name: service.name } } as never)
      }
      className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
    >
      <span
        role="img"
        aria-label={word}
        title={word}
        className={`h-2 w-2 shrink-0 rounded-full ${SERVICE_DOT_CLASS[tone]}`}
      />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-desk-chalk">
        {service.name}
      </span>
      {service.port && (
        <a
          href={`http://localhost:${service.port}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 font-mono text-2xs text-desk-text-muted"
        >
          :{service.port}
        </a>
      )}
      <span className="min-w-0 flex-1 truncate text-right font-mono text-2xs text-desk-text-muted">
        {word}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {busy ? (
          <Spinner size="small" surface="chalkboard" label="Working" />
        ) : (
          serviceActions(service).map((action) => (
            <IconButton
              key={action}
              icon={ACTION_ICONS[action]()}
              surface="chalkboard"
              size="small"
              variant="ghost"
              label={`${action[0].toUpperCase()}${action.slice(1)} ${service.name}`}
              onClick={runAction(action)}
            />
          ))
        )}
      </span>
    </button>
  );
};

export const ServicesGroup = () => {
  const client = useServicesClient();

  return (
    <div>
      <h4 className={`${groupLabelClassName} m-0`}>{SERVICES_GROUP_LABEL}</h4>
      <Card surface="chalkboard" size="small">
        {client.services.length > 0 ? (
          <div className="flex flex-col gap-2">
            {client.services.map((service) => (
              <ServiceRow key={service.name} service={service} client={client} />
            ))}
          </div>
        ) : (
          <EmptyState message="No services declared." />
        )}
      </Card>
    </div>
  );
};
