const RETRY_DELAY_MS = 500;
const RELOADED_KEY_PREFIX = 'papercamp:chunk-reloaded:';

export interface LazyPageEnv {
  wait: (ms: number) => Promise<void>;
  reload: () => void;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

const browserEnv = (): LazyPageEnv => ({
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  reload: () => window.location.reload(),
  storage: typeof sessionStorage === 'undefined' ? null : sessionStorage,
});

const readFlag = (env: LazyPageEnv, key: string): boolean => {
  try {
    return env.storage?.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (env: LazyPageEnv, key: string, on: boolean): void => {
  try {
    if (on) env.storage?.setItem(key, '1');
    else env.storage?.removeItem(key);
  } catch {}
};

/**
 * A lazy chunk can fail to load for a moment — the dev server mid-reload while
 * an agent edits files, or a tab left open across a release asking for chunk
 * names that no longer exist. One retry covers the first; one full reload, at
 * most once per tab per chunk, covers the second. After that the error is real.
 */
export async function importWithRecovery<T>(
  name: string,
  importer: () => Promise<T>,
  env: LazyPageEnv = browserEnv(),
): Promise<T> {
  const key = `${RELOADED_KEY_PREFIX}${name}`;
  try {
    const loaded = await importer();
    writeFlag(env, key, false);
    return loaded;
  } catch {
    await env.wait(RETRY_DELAY_MS);
    try {
      const loaded = await importer();
      writeFlag(env, key, false);
      return loaded;
    } catch (secondError) {
      if (readFlag(env, key)) throw secondError;
      writeFlag(env, key, true);
      env.reload();
      // The reload unloads the page; never resolve so React keeps the fallback up.
      return new Promise<T>(() => {});
    }
  }
}
