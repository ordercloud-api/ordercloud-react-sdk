import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { Persister } from "@tanstack/react-query-persist-client";
import { defaultRetryFn } from "./utils";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: defaultRetryFn,
    },
  },
});

export const asyncStoragePersister: Persister = createAsyncStoragePersister({
  storage: window.localStorage,
});
