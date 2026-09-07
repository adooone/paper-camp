import { CommandLine } from '@/app/components/command-line';
import { daemonStartCommand } from '@/app/services/hub';
import type { ModuleLayer } from '@/app/services/module-layer';
import { Card } from '@dendelion/paper-ui';

export const RuntimeUnavailable = ({ layer: _layer }: { layer?: ModuleLayer }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
    <p className="font-handwritten text-lg">The runtime is unreachable</p>
    <p className="max-w-sm text-sm opacity-60">
      Start it on the machine that holds this project, then reload.
    </p>
    <Card size="small" texture="kraft" className="mt-4 w-full max-w-sm text-left">
      <CommandLine command={daemonStartCommand(window.location.origin)} />
    </Card>
  </div>
);
