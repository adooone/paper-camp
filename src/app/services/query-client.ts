import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createStore, del, get, set } from 'idb-keyval';
import { CLIENT_VERSION } from './version';

export const PROJECT_QUERY_PREFIX = 'project';

const STALE_TIME_MS = 30_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WRITE_THROTTLE_MS = 1_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: MAX_AGE_MS,
    },
  },
});

const idbStore = createStore('paper-camp-query-cache', 'queries');

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key, idbStore),
    setItem: (key, value) => set(key, value, idbStore),
    removeItem: (key) => del(key, idbStore),
  },
  throttleTime: WRITE_THROTTLE_MS,
});

export const persistOptions: PersistQueryClientOptions = {
  queryClient,
  persister,
  maxAge: MAX_AGE_MS,
  buster: CLIENT_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] === PROJECT_QUERY_PREFIX,
  },
};
