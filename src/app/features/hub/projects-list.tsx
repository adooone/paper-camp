import { runtimeRowLabel } from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import { type RuntimeConnection, selectRuntime } from '@/app/services/runtime-connection';
import { Card, ListItem, Stamp } from '@dendelion/paper-ui';
import { AddByRuntimeUrlCard } from './add-runtime-card';

// A full load, not a client navigation: the runtime URL and API base are read once
// at startup. Back to the app root rather than the current path, which is the hub
// itself and would land straight back here.
function enterProject(runtimeUrl: string): void {
  selectRuntime(runtimeUrl, window.localStorage);
  window.location.assign(mountPrefix || '/');
}

export const ProjectsList = ({ runtimes }: { runtimes: RuntimeConnection[] }) => (
  <div className="flex flex-col gap-4">
    <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Projects</p>
      <div className="flex flex-col gap-1">
        {runtimes.map((runtime) => (
          <ListItem
            key={runtime.runtimeUrl}
            size="small"
            onClick={() => enterProject(runtime.runtimeUrl)}
            action={
              <Stamp size="small" variant="success">
                Can execute
              </Stamp>
            }
          >
            {runtimeRowLabel(runtime.runtimeUrl)}
          </ListItem>
        ))}
      </div>
    </Card>
    <AddByRuntimeUrlCard />
  </div>
);
