import { runtimeRowLabel } from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import {
  type RuntimeConnection,
  removeRuntime,
  selectRuntime,
} from '@/app/services/runtime-connection';
import { Card, CloseIcon, IconButton, ListItem, Stamp } from '@dendelion/paper-ui';
import { AddByRuntimeUrlCard } from './add-runtime-card';
import { RenameRuntimeButton } from './rename-runtime-button';
import { useProjectNames } from './use-project-names';

// A full load, not a client navigation: the runtime URL and API base are read once
// at startup. Back to the app root rather than the current path, which is the hub
// itself and would land straight back here.
function enterProject(runtimeUrl: string): void {
  selectRuntime(runtimeUrl, window.localStorage);
  window.location.assign(mountPrefix || '/');
}

export const ProjectsList = ({
  runtimes,
  onChange,
}: {
  runtimes: RuntimeConnection[];
  onChange: () => void;
}) => {
  const names = useProjectNames(runtimes);
  return (
    <div className="flex flex-col gap-4">
      <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
        <p className="m-0 font-semibold">Projects</p>
        <div className="flex flex-col gap-1">
          {runtimes.map((runtime) => {
            const announcedName = names[runtime.runtimeUrl];
            const displayName = runtime.label ?? announcedName;
            return (
              <div key={runtime.runtimeUrl} className="flex items-center gap-1">
                <ListItem
                  size="small"
                  className="flex-1"
                  onClick={() => enterProject(runtime.runtimeUrl)}
                  action={
                    <Stamp size="small" variant="success">
                      Can execute
                    </Stamp>
                  }
                >
                  {displayName ? (
                    <span className="flex flex-col gap-0.5 text-left">
                      <span>{displayName}</span>
                      <span className="font-handwritten text-2xs opacity-60">
                        {runtimeRowLabel(runtime.runtimeUrl)}
                      </span>
                    </span>
                  ) : (
                    runtimeRowLabel(runtime.runtimeUrl)
                  )}
                </ListItem>
                <RenameRuntimeButton
                  runtimeUrl={runtime.runtimeUrl}
                  currentLabel={runtime.label ?? announcedName ?? ''}
                  onRenamed={onChange}
                />
                <IconButton
                  variant="danger"
                  size="small"
                  aria-label={`Remove ${displayName ?? runtimeRowLabel(runtime.runtimeUrl)}`}
                  icon={<CloseIcon size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRuntime(runtime.runtimeUrl, window.localStorage);
                    onChange();
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>
      <AddByRuntimeUrlCard />
    </div>
  );
};
