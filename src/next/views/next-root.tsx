import { Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useAppearanceStore } from '../stores/appearance-slice';
import { tokenVars } from '../ui/tokens';
import { appearanceVars } from '../ui/typography';

export const NextRoot = () => {
  const appearance = useAppearanceStore((state) => state.appearance);
  const style = useMemo(() => ({ ...tokenVars, ...appearanceVars(appearance) }), [appearance]);
  return (
    <div data-chalk="grey" style={style}>
      <Outlet />
    </div>
  );
};
