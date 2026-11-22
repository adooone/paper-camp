import { ToastProvider } from '@dendelion/folk-ui';
import { Outlet } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useAppearanceStore } from '../stores/appearance-slice';
import { tokenVars } from '../ui/tokens';
import { appearanceVars } from '../ui/typography';

const CHALK = 'grey';

export const NextRoot = () => {
  const appearance = useAppearanceStore((state) => state.appearance);
  const style = useMemo(() => ({ ...tokenVars, ...appearanceVars(appearance) }), [appearance]);
  useEffect(() => {
    document.documentElement.dataset.chalk = CHALK;
    return () => {
      delete document.documentElement.dataset.chalk;
    };
  }, []);
  return (
    <div data-chalk={CHALK} style={style}>
      <ToastProvider position="bottom-left" surface="chalkboard">
        <Outlet />
      </ToastProvider>
    </div>
  );
};
