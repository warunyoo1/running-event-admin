"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Flag,
  ShoppingBag,
  ScanLine,
  Users,
  Truck,
  ChartNoAxesCombined,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  KeyRound,
  CircleHelp,
  History,
} from "lucide-react";
import { useAuth } from "@/features/admin/auth-provider";
import { useScope } from "@/features/admin/scope-provider";
import { useToast } from "@/features/admin/toast-provider";
import { useAsync } from "@/features/admin/use-async";
import { isSuper } from "@/features/admin/permissions";
import { roleDescriptions, roleLabels } from "@/features/admin/format";
import { dashboardApi } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { ALL_EVENTS, MUST_CHANGE_PASSWORD_SHOWN_KEY } from "@/lib/constants";
import { ChangePasswordModal } from "./change-password-modal";
import { Modal } from "./ui";
import { EventScopeSelect } from "./event-scope-select";

type NavItem = {
  href: string;
  title: string;
  icon: typeof Flag;
  scope: "event" | "global";
  superOnly?: boolean;
};

const navigation: NavItem[] = [
  { href: "/", title: "ภาพรวม", icon: LayoutDashboard, scope: "event" },
  { href: "/orders", title: "ออเดอร์", icon: ShoppingBag, scope: "event" },
  { href: "/slips", title: "ตรวจสลิป", icon: ScanLine, scope: "event" },
  { href: "/participants", title: "ผู้สมัคร", icon: Users, scope: "event" },
  {
    href: "/shipping",
    title: "รับชุดวิ่งและจัดส่ง",
    icon: Truck,
    scope: "event",
  },
  {
    href: "/reports",
    title: "รายงาน",
    icon: ChartNoAxesCombined,
    scope: "event",
  },
  { href: "/events", title: "จัดการงานวิ่ง", icon: Flag, scope: "global" },
  {
    href: "/users",
    title: "ผู้ใช้และสิทธิ์",
    icon: ShieldCheck,
    scope: "global",
    superOnly: true,
  },
  {
    href: "/audit-logs",
    title: "ประวัติการใช้งาน",
    icon: History,
    scope: "global",
    superOnly: true,
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, refresh } = useAuth();
  const notify = useToast();
  const {
    events,
    eventId,
    scopeEventId,
    selectedEvent,
    setEventId,
    ready,
    error: scopeError,
  } = useScope();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordNudge, setPasswordNudge] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const currentPage = navigation.find((item) => item.href === pathname);
  const title = currentPage?.title ?? "รายละเอียด";
  const isGlobal = currentPage?.scope === "global";
  const scopeLabel = ready ? selectedEvent?.name ?? "งานวิ่งทั้งหมด" : "กำลังโหลดงาน…";
  const waiting =
    useAsync(
      (signal) => dashboardApi.getDashboard(scopeEventId, signal),
      [scopeEventId, pathname],
    ).data?.pendingReview ?? 0;
  const initials = user.name.trim().slice(0, 2).toUpperCase();
  const visibleNavigation = navigation.filter(
    (item) => !item.superOnly || isSuper(user.role),
  );
  const mustChangePassword = Boolean(user.mustChangePassword);
  useEffect(() => {
    if (!mustChangePassword) return;
    try {
      if (sessionStorage.getItem(MUST_CHANGE_PASSWORD_SHOWN_KEY)) return;
      sessionStorage.setItem(MUST_CHANGE_PASSWORD_SHOWN_KEY, "1");
    } catch {
      // Storage can be blocked; showing the dismissible nudge again is harmless.
    }
    setPasswordNudge(true);
  }, [mustChangePassword]);
  useEffect(() => {
    if (scopeError) notify(scopeError);
  }, [scopeError, notify]);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, title]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setMobile(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!menuOpen || !mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button, select",
        ) ?? [],
      ).filter((item) => item.getClientRects().length > 0);
    items()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        const focusable = items();
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [menuOpen, mobile]);
  async function handleLogout() {
    try {
      await logout();
    } catch (reason) {
      notify(errorMessage(reason));
    }
  }
  function renderNavigation(scope: "event" | "global") {
    return visibleNavigation
      .filter((item) => item.scope === scope)
      .map(({ href, title: label, icon: Icon }) => (
        <Link
          className={`nav-item ${pathname === href ? "active" : ""}`}
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
          {href === "/slips" && waiting > 0 && (
            <span
              className="nav-count"
              aria-label={`${waiting} ออเดอร์รอตรวจสลิปในงานที่เลือก`}
            >
              {waiting}
            </span>
          )}
        </Link>
      ));
  }
  return (
    <div className="admin-app">
      <title>{`${title} | RunOps`}</title>
      <a className="skip-link" href="#main">
        ข้ามไปที่เนื้อหา
      </a>
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="ปิดเมนู"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobile && !menuOpen}
        id="main-navigation"
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="เมนูหลัก"
      >
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Flag size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>
            run<span className="brand-ops">ops</span>
            <small>จัดการทุกก้าวของงานวิ่ง</small>
          </span>
        </Link>
        <button
          className="icon-button close-menu"
          aria-label="ปิดเมนู"
          onClick={() => setMenuOpen(false)}
        >
          <X size={21} />
        </button>
        <div className="sidebar-navigation">
        <div className="workspace-label">
          <EventScopeSelect
            options={[{ id: ALL_EVENTS, name: "งานวิ่งทั้งหมด" }, ...events]}
            value={eventId}
            onChange={setEventId}
            disabled={!ready}
            label={scopeLabel}
          />
          <p id="event-scope-hint" className="sr-only">
            {eventId === ALL_EVENTS
              ? "แสดงข้อมูลรวมของทุกงานวิ่ง"
              : "แสดงข้อมูลเฉพาะงานที่เลือก"}
          </p>
        </div>
        <p className="nav-label" id="event-navigation-label">
          ข้อมูลของงานที่เลือก
        </p>
        <nav aria-labelledby="event-navigation-label">
          {renderNavigation("event")}
        </nav>
        <p className="nav-label nav-section-label" id="global-navigation-label">
          จัดการระบบ · ทุกงาน
        </p>
        <nav aria-labelledby="global-navigation-label">
          {renderNavigation("global")}
        </nav>
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-item help-button"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={19} aria-hidden="true" />
            วิธีใช้งาน
          </button>
          <div className="profile">
            <span className="avatar">{initials}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
            <span className="profile-actions">
              <button
                className="icon-button"
                aria-label="เปลี่ยนรหัสผ่าน"
                onClick={() => setPasswordOpen(true)}
              >
                <KeyRound size={17} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                aria-label="ออกจากระบบ"
                onClick={handleLogout}
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobile && menuOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="เปิดเมนู"
              aria-expanded={menuOpen}
              aria-controls="main-navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-home">
              {isGlobal ? "จัดการระบบ" : "ข้อมูลของงานที่เลือก"}
            </span>
            <ChevronRight size={15} aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className="scope-indicator"
              title={
                isGlobal
                  ? "หน้านี้แสดงข้อมูลของทุกงาน ไม่ขึ้นกับงานที่เลือกในเมนู"
                  : scopeLabel
              }
            >
              {isGlobal ? (
                <ShieldCheck size={16} aria-hidden="true" />
              ) : (
                <Flag size={16} aria-hidden="true" />
              )}
              <span>{isGlobal ? "ข้อมูลทุกงาน" : scopeLabel}</span>
            </span>
            <span className="avatar small" aria-label={user.name}>
              {initials}
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {ready ? children : <p className="context-loading" role="status">กำลังโหลด…</p>}
        </main>
        <footer className="page-footer">
          <span>
            RunOps <span aria-hidden="true">/</span> ระบบจัดการงานวิ่ง
          </span>
        </footer>
      </div>
      {passwordOpen && (
        <ChangePasswordModal
          onClose={() => setPasswordOpen(false)}
          onChanged={refresh}
        />
      )}
      {passwordNudge && !passwordOpen && (
        <ChangePasswordModal
          notice="บัญชีนี้ยังใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ของคุณเอง"
          onClose={() => setPasswordNudge(false)}
          onChanged={refresh}
        />
      )}
      {helpOpen && (
        <Modal
          title="วิธีใช้งาน RunOps"
          onClose={() => setHelpOpen(false)}
        >
          <div className="modal-body prose">
            <p>
              เลือกงานวิ่งจากเมนูด้านซ้าย แล้วดูภาพรวม ออเดอร์ สลิป ผู้สมัคร
              การรับชุดวิ่ง และรายงานของงานนั้นได้ ส่วน “จัดการระบบ”
              ใช้กับทุกงาน ไม่ขึ้นกับงานที่เลือก
            </p>
            <p>
              สิทธิ์ของคุณคือ “{roleLabels[user.role]}”: {roleDescriptions[user.role]}
            </p>
            <p>เมนูผู้ใช้และสิทธิ์ กับประวัติการใช้งาน เปิดให้เฉพาะผู้ดูแลระบบ</p>
          </div>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() => setHelpOpen(false)}
            >
              เข้าใจแล้ว
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
