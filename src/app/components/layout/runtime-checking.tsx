import { Spinner } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const SLOW_CHECK_MS = 10_000;

// A route with no list skeleton of its own shows this instead of an empty column
// while its layer's reachability (or a lazy chunk) is still resolving.
export const RuntimeChecking = ({ label }: { label: string }) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
      <Spinner label={label} />
      <p className="m-0 text-sm opacity-60">{label}</p>
      {slow && <p className="m-0 text-sm opacity-60">Still checking the tools on this machine…</p>}
    </div>
  );
};
