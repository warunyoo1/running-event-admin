"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  initialState,
  type DemoState,
  type Order,
  type RunningEvent,
  type AdminUser,
} from "./data";

type DemoContext = DemoState & {
  ready: boolean;
  eventId: string;
  setEventId: (id: string) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  saveEvent: (event: RunningEvent) => void;
  saveUser: (user: AdminUser) => void;
  notify: (message: string) => void;
};
const Context = createContext<DemoContext | null>(null);
const storageKey = "runops-demo-v1";
const selectionKey = "runops-selected-event";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);
  const [eventId, setEventId] = useState("all");
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      let restoredEvents = initialState.events;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as DemoState;
        if (
          Array.isArray(parsed.events) &&
          Array.isArray(parsed.orders) &&
          Array.isArray(parsed.users)
        ) {
          setState(parsed);
          restoredEvents = parsed.events;
        }
      }
      const selected = localStorage.getItem(selectionKey);
      if (selected && restoredEvents.some((event) => event.id === selected))
        setEventId(selected);
    } catch {
      setMessage("ไม่สามารถอ่านข้อมูลสาธิตที่บันทึกไว้ จึงใช้ข้อมูลเริ่มต้น");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      localStorage.setItem(selectionKey, eventId);
    } catch {
      setMessage("เบราว์เซอร์ไม่อนุญาตให้บันทึก ข้อมูลสาธิตจะอยู่เฉพาะหน้านี้");
    }
  }, [state, eventId, ready]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <Context.Provider
      value={{
        ...state,
        ready,
        eventId,
        setEventId,
        notify: setMessage,
        updateOrder: (id, patch) =>
          setState((current) => ({
            ...current,
            orders: current.orders.map((order) =>
              order.id === id ? { ...order, ...patch } : order,
            ),
          })),
        saveEvent: (event) =>
          setState((current) => ({
            ...current,
            events: current.events.some((item) => item.id === event.id)
              ? current.events.map((item) =>
                  item.id === event.id ? event : item,
                )
              : [...current.events, event],
          })),
        saveUser: (user) =>
          setState((current) => ({
            ...current,
            users: current.users.some((item) => item.id === user.id)
              ? current.users.map((item) => (item.id === user.id ? user : item))
              : [...current.users, user],
          })),
      }}
    >
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-atomic="true"
      >
        {message}
      </div>
    </Context.Provider>
  );
}

export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error("useDemo must be used within DemoProvider");
  return context;
}
