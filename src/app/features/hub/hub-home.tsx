import { listRuntimes } from '@/app/services/runtime-connection';
import { ProjectsList } from './projects-list';
import { WelcomeScreen } from './welcome-screen';

export const HubHome = () => {
  const runtimes = listRuntimes(typeof window === 'undefined' ? null : window.localStorage);
  if (runtimes.length === 0) return <WelcomeScreen />;
  return <ProjectsList runtimes={runtimes} />;
};
