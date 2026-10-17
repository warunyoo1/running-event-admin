"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";
import { EmptyState } from "@/components/ui";

type AuthContext = {
  user: User;
  logout: () => Promise<void>;
};
const Context = createContext<AuthContext | null>(null);

function loginUrl() {
  const { pathname, search } = window.location;
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace(loginUrl());
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    authApi
      .me(controller.signal)
      .then(setUser)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        // 401 is handled by the unauthorized handler; anything else is an outage, not a logout.
        if (reason instanceof ApiError && reason.status === 401) return;
        setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [attempt]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    router.replace("/login");
  }, [router]);

  if (error)
    return (
      <main className="context-loading">
        <EmptyState title="โหลดข้อมูลผู้ใช้ไม่สำเร็จ" description={error} />
        <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
          ลองใหม่
        </button>
      </main>
    );
  if (!user)
    return (
      <p className="context-loading" role="status">
        กำลังโหลดพื้นที่ทำงาน…
      </p>
    );
  return <Context.Provider value={{ user, logout }}>{children}</Context.Provider>;
}

export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
