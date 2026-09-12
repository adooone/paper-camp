import type { PushDeviceSummary } from '@/app/services/system';
import { CloseIcon, Divider, IconButton, Stamp } from '@dendelion/paper-ui';

interface NotificationDeviceRowProps {
  device: PushDeviceSummary;
  isLast: boolean;
  onRemove: () => void;
}

export const NotificationDeviceRow = ({ device, isLast, onRemove }: NotificationDeviceRowProps) => {
  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <span>{device.name}</span>
          <Stamp size="small" variant="neutral">
            {device.transport === 'webpush' ? 'Browser' : 'Phone'}
          </Stamp>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-50 text-sm">
            {device.lastDeliveryAt
              ? `Last delivery ${new Date(device.lastDeliveryAt).toLocaleString()}`
              : 'No deliveries yet'}
          </span>
          <IconButton
            icon={<CloseIcon size={16} />}
            variant="danger"
            size="small"
            onClick={onRemove}
            label={`Remove ${device.name}`}
          />
        </div>
      </div>
      {!isLast && <Divider />}
    </>
  );
};
