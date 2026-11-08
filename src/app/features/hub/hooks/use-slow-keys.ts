import { useEffect, useState } from 'react';

const WAITING_AFTER_MS = 4_000;

export function useSlowKeys(pendingKeys: string[]): Set<string> {
  const [slow, setSlow] = useState<Set<string>>(new Set());
  const pending = pendingKeys.join('\n');

  useEffect(() => {
    const keys = pending === '' ? [] : pending.split('\n');
    setSlow((current) => {
      const next = new Set(keys.filter((key) => current.has(key)));
      return next.size === current.size ? current : next;
    });
    const timers = keys.map((key) =>
      setTimeout(() => setSlow((current) => new Set(current).add(key)), WAITING_AFTER_MS),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [pending]);

  return slow;
}
