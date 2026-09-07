import { CommandLine } from '@/app/components/command-line';
import { daemonStartCommand } from '@/app/services/hub';
import { Card } from '@dendelion/paper-ui';

export const GetStartedCard = () => {
  const startCommand = daemonStartCommand(window.location.origin);

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Get started</p>
      <div className="flex flex-col gap-2">
        <CommandLine command="npm install -g @dendelion/paper-camp" />
        <CommandLine command="paper-camp scan ~/dev" />
        <p className="m-0 text-sm opacity-70">
          ~/dev stands for the folder holding your repositories; paper-camp init inside a single
          repo registers just that one.
        </p>
        <CommandLine command={startCommand} />
      </div>
      <p className="m-0 text-sm opacity-70">
        Then open the link the daemon prints in your terminal.
      </p>
    </Card>
  );
};
