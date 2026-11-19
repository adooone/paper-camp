import { Outlet } from '@tanstack/react-router';
import { tokenVars } from '../ui/tokens';

export const NextRoot = () => (
  <div data-chalk="grey" style={tokenVars}>
    <Outlet />
  </div>
);
