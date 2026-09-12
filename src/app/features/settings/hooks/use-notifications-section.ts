import { mountPrefix } from '@/app/services/mount';
import {
  type PushDeviceSummary,
  fetchConfig,
  fetchPushDevices,
  fetchPushPublicKey,
  saveConfig,
  subscribeWebPush,
  unsubscribePush,
} from '@/app/services/system';
import {
  DEFAULT_NOTIFICATION_KINDS,
  NOTIFICATION_SETTING_KINDS,
  type NotificationSettingKind,
  type PaperCampConfig,
} from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

const SW_PATH = `${mountPrefix}/sw.js`;

const isPushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window;

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = `${base64}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer;
}

// No Web Push subscription carries a human name, so this browser names itself once,
// the way `subscribeWebPush`'s server-side record needs a `name` for the Devices list.
function describeThisBrowser(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const platform = /Mac OS X/.test(ua)
    ? 'Mac'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return platform ? `${browser} on ${platform}` : browser;
}

export const useNotificationsSection = () => {
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [devices, setDevices] = useState<PushDeviceSummary[] | undefined>(undefined);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busyDevice, setBusyDevice] = useState(false);
  const { toast } = useToast();

  const supported = isPushSupported();

  const reloadDevices = useCallback(async () => {
    const fresh = await fetchPushDevices();
    setDevices(fresh ?? []);
  }, []);

  const reloadSubscriptionState = useCallback(async () => {
    if (!supported) return;
    setPermission(Notification.permission);
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const existing = await registration?.pushManager.getSubscription();
    setSubscribed(existing !== null && existing !== undefined);
  }, [supported]);

  useEffect(() => {
    fetchConfig().then(setConfig);
    reloadDevices();
    reloadSubscriptionState();
  }, [reloadDevices, reloadSubscriptionState]);

  const kinds: Record<NotificationSettingKind, boolean> = {
    ...DEFAULT_NOTIFICATION_KINDS,
    ...config?.notifications?.kinds,
  };

  const handleToggleKind = async (kind: NotificationSettingKind) => {
    const next = { ...kinds, [kind]: !kinds[kind] };
    const { ok, error } = await saveConfig({ notifications: { kinds: next } });
    if (ok) {
      setConfig(await fetchConfig());
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const subscribeThisDevice = async () => {
    const permissionResult =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPermission(permissionResult);
    if (permissionResult !== 'granted') {
      toast({
        title: 'Notifications blocked',
        description: 'Allow notifications for this site in the browser to subscribe.',
        variant: 'error',
      });
      return;
    }
    const publicKey = await fetchPushPublicKey();
    if (!publicKey) {
      toast({
        title: 'Failed to subscribe',
        description: 'Could not reach the daemon.',
        variant: 'error',
      });
      return;
    }
    const registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh: string; auth: string };
    };
    if (!json.endpoint || !json.keys) {
      await subscription.unsubscribe();
      toast({
        title: 'Failed to subscribe',
        description: 'Subscription had no keys.',
        variant: 'error',
      });
      return;
    }
    const { ok, error } = await subscribeWebPush(describeThisBrowser(), {
      endpoint: json.endpoint,
      keys: json.keys,
    });
    if (!ok) {
      await subscription.unsubscribe();
      toast({ title: 'Failed to subscribe', description: error, variant: 'error' });
      return;
    }
    setSubscribed(true);
    reloadDevices();
  };

  const unsubscribeThisDevice = async () => {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const existing = await registration?.pushManager.getSubscription();
    if (existing) {
      await unsubscribePush('webpush', existing.endpoint);
      await existing.unsubscribe();
    }
    setSubscribed(false);
    reloadDevices();
  };

  const handleToggleDevice = async () => {
    setBusyDevice(true);
    try {
      if (subscribed) await unsubscribeThisDevice();
      else await subscribeThisDevice();
    } finally {
      setBusyDevice(false);
    }
  };

  const handleRemoveDevice = async (device: PushDeviceSummary) => {
    const { ok, error } = await unsubscribePush(device.transport, device.key);
    if (ok) {
      reloadDevices();
      reloadSubscriptionState();
    } else {
      toast({ title: 'Failed to remove', description: error, variant: 'error' });
    }
  };

  return {
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
    kindList: NOTIFICATION_SETTING_KINDS,
  };
};
