import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import { useEffect, useState } from 'react';

// Vite's HMR websocket, not the app's own SSE stream — it must still reach the
// client when src/app/server/** fails to hot-swap and the API graph never loads.
export const ServerReloadBanner = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const onError = (data: { message: string }) => setMessage(data.message);
    const onOk = () => setMessage(null);
    hot.on('papercamp:server-reload-error', onError);
    hot.on('papercamp:server-reload-ok', onOk);
    return () => {
      hot.off('papercamp:server-reload-error', onError);
      hot.off('papercamp:server-reload-ok', onOk);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        background: color.accentRoseDark,
        color: color.deskText,
        padding: `${space[2]} ${space[4]}`,
        fontSize: fontSize['2xs'],
        fontFamily: fontFamily.mono,
        flexShrink: 0,
      }}
    >
      Server failed to reload — restart `pnpm dev` to pick up the change. {message}
    </div>
  );
};
