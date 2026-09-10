import { CLIENT_VERSION } from '@/app/services/version';
import { useAppStore } from '@/app/stores/app-store';
import { Divider } from '@dendelion/paper-ui';

export function versionLabel(runtimeVersion: string | null, clientVersion: string): string {
  if (!runtimeVersion) return `Paper Camp v${clientVersion}`;
  if (runtimeVersion === clientVersion) return `Paper Camp v${runtimeVersion}`;
  return `Paper Camp v${runtimeVersion} · client v${clientVersion}`;
}

export const VersionFooter = () => {
  const runtimeVersion = useAppStore((s) => s.runtimeVersion);
  return (
    <div className="shrink-0">
      <Divider surface="chalkboard" />
      <p className="m-0 px-[var(--pc-stack-pad)] py-2 font-handwritten text-sm tracking-wide text-desk-text-muted">
        {versionLabel(runtimeVersion, CLIENT_VERSION)}
      </p>
    </div>
  );
};
