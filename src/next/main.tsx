import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/folk-ui/dist/index.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { connectRuntime, resolveProject } from '@/app/services/boot';
import { mountPrefix } from '@/app/services/mount';
import { persistOptions, queryClient } from '@/app/services/query-client';
import { nextBasepath } from './entry-path';
import { router } from './router';

connectRuntime();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);

void resolveProject(`${nextBasepath(mountPrefix)}/`);
