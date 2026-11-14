import { daemonStartCommand } from '@/app/services/hub';
import type { ModuleLayer } from '@/app/services/module-layer';
import { useAppStore } from '@/app/stores/app-store';
import { Card, CommandLine } from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';

export const RuntimeUnavailable = ({ layer: _layer }: { layer?: ModuleLayer }) => {
  const slow = useAppStore((s) => s.runtimeSlow);
  if (slow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="font-handwritten text-lg">The runtime is responding slowly</p>
        <p className="max-w-sm text-sm opacity-60">
          The machine is busy. This page will retry on its own.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="font-handwritten text-lg">The runtime is unreachable</p>
      <p className="max-w-sm text-sm opacity-60">
        Start it on the machine that holds this project, then reload.
      </p>
      <Card size="small" texture={surface.card} className="mt-4 w-full max-w-sm text-left">
        <CommandLine command={daemonStartCommand(window.location.origin)} />
      </Card>
    </div>
  );
};
