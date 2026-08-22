import { AddByRuntimeUrlCard } from './add-runtime-card';
import { GithubConnectCard } from './github-connect-card';

export const WelcomeScreen = () => (
  <div className="flex flex-col gap-6">
    <p className="m-0 text-center text-sm opacity-70">
      Nothing is open yet — connect GitHub, or add a project by its runtime URL.
    </p>
    <div className="flex flex-col gap-4 sm:flex-row">
      <GithubConnectCard />
      <AddByRuntimeUrlCard />
    </div>
  </div>
);
