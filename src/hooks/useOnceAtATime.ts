import { useRef, useCallback } from 'react';

/**
 * useOnceAtATime
 *
 * A React hook that ensures an async function is only executed once at a time.
 * While the function is in-flight, all subsequent calls return the same Promise.
 * Once the function resolves or rejects, it can be called again.
 *
 * Useful for deduplicating concurrent requests (e.g. token validation, lazy loading).
 *
 * @template TArgs - Argument types of the async function
 * @template TResult - Return type of the async function
 *
 * @param fn - The async function to guard
 * @returns An object with:
 *   - run: the deduplicated function
 *   - isRunning: boolean indicating whether the function is currently executing
 */
export function useOnceAtATime<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const inFlightRef = useRef<Promise<TResult> | null>(null);

  const run = useCallback((...args: TArgs): Promise<TResult> => {
    if (inFlightRef.current) return inFlightRef.current;

    inFlightRef.current = (async () => {
      try {
        return await fn(...args);
      } finally {
        inFlightRef.current = null; // allow future calls
      }
    })();

    return inFlightRef.current;
  }, [fn]);

  const isRunning = !!inFlightRef.current;

  return { run, isRunning };
}