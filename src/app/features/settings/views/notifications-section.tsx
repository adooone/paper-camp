import { EmptyState, RowSkeleton } from '@/app/components';
import { Alert, Card, Divider, Stamp, Switch } from '@dendelion/paper-ui';
import { NOTIFICATION_KIND_LABELS, PERMISSION_STAMP } from '../constants';
import { useNotificationsSection } from '../hooks/use-notifications-section';
import { NotificationDeviceRow } from './notification-device-row';

export const NotificationsSection = () => {
  const {
    config,
    kinds,
    handleToggleKind,
    supported,
    permission,
    subscribed,
    busyDevice,
    handleToggleDevice,
    devices,
    handleRemoveDevice,
    kindList,
  } = useNotificationsSection();

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Notifications</h2>
        <p className="opacity-50 mt-1">
          Choose which events interrupt you, and which devices hear about them.
        </p>
      </div>
      {config === undefined && <RowSkeleton />}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <>
          <Card size="small" texture="kraft">
            {kindList.map((kind, idx) => (
              <div key={kind}>
                <div className="flex items-center justify-between gap-3 pb-2 pt-2">
                  <span>{NOTIFICATION_KIND_LABELS[kind]}</span>
                  <Switch checked={kinds[kind]} onChange={() => handleToggleKind(kind)} />
                </div>
                {idx < kindList.length - 1 && <Divider />}
              </div>
            ))}
          </Card>

          <div className="mt-6 mb-3">
            <h3 className="m-0">This device</h3>
          </div>
          <Card size="small" texture="kraft">
            {!supported ? (
              <Alert variant="warning">This browser doesn't support push notifications.</Alert>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span>Push notifications</span>
                  <Stamp size="small" variant={PERMISSION_STAMP[permission].variant}>
                    {PERMISSION_STAMP[permission].label}
                  </Stamp>
                </div>
                <Switch
                  checked={subscribed}
                  onChange={handleToggleDevice}
                  disabled={busyDevice || permission === 'denied'}
                />
              </div>
            )}
          </Card>

          <div className="mt-6 mb-3">
            <h3 className="m-0">Devices</h3>
          </div>
          <Card size="small" texture="kraft">
            {devices === undefined && <RowSkeleton />}
            {devices && devices.length === 0 && <EmptyState message="No subscribed devices yet." />}
            {devices?.map((device, idx) => (
              <NotificationDeviceRow
                key={`${device.transport}:${device.key}`}
                device={device}
                isLast={idx === devices.length - 1}
                onRemove={() => handleRemoveDevice(device)}
              />
            ))}
          </Card>
        </>
      )}
    </div>
  );
};
