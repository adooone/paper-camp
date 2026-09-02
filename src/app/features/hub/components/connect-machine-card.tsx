import { machineProjectRuntimeUrl, runtimeAdditionUrl } from '@/app/services/hub';
import { Button, Card, Input, ListItem } from '@dendelion/paper-ui';
import { useMachineConnect } from '../hooks';

function openMachineProject(machineUrl: string, slug: string): void {
  window.location.assign(
    runtimeAdditionUrl(window.location.pathname, machineProjectRuntimeUrl(machineUrl, slug)),
  );
}

export const ConnectMachineCard = () => {
  const { machineUrl, setMachineUrl, connectedUrl, projects, loading, error, connect } =
    useMachineConnect();

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Connect to a machine</p>
      <p className="m-0 text-sm opacity-70">
        Paste the address of a machine running <code>paper-camp daemon</code> this browser can reach
        — its LAN or tailnet address from another machine. <code>localhost</code> only works on the
        machine running it.
      </p>
      <Input
        size="small"
        label="Machine URL"
        placeholder="http://localhost:4333"
        value={machineUrl}
        onChange={(e) => setMachineUrl(e.target.value)}
      />
      {projects ? (
        <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
          {projects.map((project) => (
            <ListItem
              key={project.slug}
              size="small"
              className="min-w-0"
              onClick={() => openMachineProject(connectedUrl, project.slug)}
            >
              <span className="truncate">{project.name}</span>
            </ListItem>
          ))}
        </div>
      ) : (
        <>
          {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
          <Button size="small" disabled={machineUrl.trim() === '' || loading} onClick={connect}>
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        </>
      )}
    </Card>
  );
};
