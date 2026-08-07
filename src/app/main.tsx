import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/paper-ui/dist/index.css';
import './styles/utilities.css';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { setApiBase } from './services/api-base';
import { mountPrefix } from './services/mount';

setApiBase(mountPrefix);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
