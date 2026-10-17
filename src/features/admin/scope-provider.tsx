"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { eventsApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { ALL_EVENTS, MAX_PAGE_SIZE, SELECTED_EVENT_KEY } from "@/lib/constants";
import type { AdminEvent } from "@/lib/api/types";

type ScopeContext = {
  events: AdminEvent[];
  eventId: string;
  /** `eventId` ready for API queries: undefined means all events. */
  scopeEventId: string | undefined;
  selectedEvent: AdminEvent | undefined;
  setEventId: (id: string) => void;
  ready: boolean;
  error: string;
  reloadEvents: () => void;
};
const Context = createContext<ScopeContext | null>(null);

async function loadAllEvents(signal: AbortSignal) {
  const events: AdminEvent[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await eventsApi.listEvents({ page, pageSize: MAX_PAGE_SIZE }, signal);
    events.push(...result.data);
    totalPages = result.meta.totalPages;
    page += 1;
  }
  return events;
}

function readStored() {
  try {
    return localStorage.getItem(SELECTED_EVENT_KEY);
  } catch {
    return null;
  }
}
function writeStored(id: string) {
  try {
    if (id === ALL_EVENTS) localStorage.removeItem(SELECTED_EVENT_KEY);
    else localStorage.setItem(SELECTED_EVENT_KEY, id);
  } catch {
    // Selection simply is not remembered when storage is unavailable.
  }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setSelected] = useState(ALL_EVENTS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadAllEvents(controller.signal)
      .then((loaded) => {
        setEvents(loaded);
        setError("");
        setSelected((current) => {
          const wanted = current !== ALL_EVENTS ? current : readStored();
          if (wanted && loaded.some((event) => event.id === wanted)) return wanted;
          writeStored(ALL_EVENTS);
          return ALL_EVENTS;
        });
        setReady(true);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason));
        setReady(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const setEventId = useCallback((id: string) => {
    setSelected(id);
    writeStored(id);
  }, []);
  const reloadEvents = useCallback(() => setAttempt((value) => value + 1), []);

  const value = useMemo<ScopeContext>(
    () => ({
      events,
      eventId,
      scopeEventId: eventId === ALL_EVENTS ? undefined : eventId,
      selectedEvent: events.find((event) => event.id === eventId),
      setEventId,
      ready,
      error,
      reloadEvents,
    }),
    [events, eventId, setEventId, ready, error, reloadEvents],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useScope() {
  const context = useContext(Context);
  if (!context) throw new Error("useScope must be used within ScopeProvider");
  return context;
}
