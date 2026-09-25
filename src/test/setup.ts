import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, vi } from "vitest";
import { queryClient } from "../query";

beforeEach(() => {
  queryClient.clear();
  window.localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();

  // Eject any leftover Axios request interceptors between tests
  const handlers = (
    axios.interceptors.request as unknown as {
      handlers: Array<{ fulfilled?: unknown } | null>;
    }
  ).handlers;
  handlers.forEach((handler, id) => {
    if (handler) {
      axios.interceptors.request.eject(id);
    }
  });
});
