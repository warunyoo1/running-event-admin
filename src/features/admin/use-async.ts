"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, isAbortError } from "@/lib/api/errors";

type AsyncState<T> = {
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => void;
};

/** Runs `fn` on mount and whenever `deps` change; aborts stale requests. */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, error: "", loading: true }));
    fnRef
      .current(controller.signal)
      .then((data) => setState({ data, error: "", loading: false }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setState((current) => ({ ...current, error: errorMessage(error), loading: false }));
      });
    return () => controller.abort();
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
