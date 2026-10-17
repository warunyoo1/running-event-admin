"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const TOAST_MS = 5000;
const Context = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);
  const notify = useCallback((text: string) => setMessage(text), []);
  return (
    <Context.Provider value={notify}>
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

export function useToast() {
  const notify = useContext(Context);
  if (!notify) throw new Error("useToast must be used within ToastProvider");
  return notify;
}
