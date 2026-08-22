import { runtimeRowLabel } from '@/app/services/hub';
import type { RuntimeConnection } from '@/app/services/runtime-connection';
import { Card, ListItem, Stamp } from '@dendelion/paper-ui';

export const ProjectsList = ({ runtimes }: { runtimes: RuntimeConnection[] }) => (
  <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
    <p className="m-0 font-semibold">Projects</p>
    <div className="flex flex-col gap-1">
      {runtimes.map((runtime) => (
        <ListItem
          key={runtime.runtimeUrl}
          size="small"
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
);
