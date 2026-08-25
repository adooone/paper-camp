import { listRuntimes } from '@/app/services/runtime-connection';
import { useState } from 'react';
import { ProjectsList } from './projects-list';
import { WelcomeScreen } from './welcome-screen';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export const HubHome = () => {
  const [runtimes, setRuntimes] = useState(() => listRuntimes(storage));
  if (runtimes.length === 0) return <WelcomeScreen />;
  return <ProjectsList runtimes={runtimes} onChange={() => setRuntimes(listRuntimes(storage))} />;
};
