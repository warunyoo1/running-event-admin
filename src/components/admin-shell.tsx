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
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";
import { useDemo } from "@/features/admin/demo-store";
import { Modal } from "./ui";

const navigation = [
  { href: "/", title: "ภาพรวม", icon: LayoutDashboard, scope: "event" },
  { href: "/orders", title: "ออเดอร์", icon: ShoppingBag, scope: "event" },
  { href: "/slips", title: "ตรวจสลิป", icon: ScanLine, scope: "event" },
  { href: "/participants", title: "ผู้สมัคร", icon: Users, scope: "event" },
  {
    href: "/shipping",
    title: "รับอุปกรณ์และจัดส่ง",
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
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { events, orders, eventId, setEventId, ready } = useDemo();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const currentPage = navigation.find((item) => item.href === pathname);
  const title = currentPage?.title ?? "รายละเอียด";
  const isGlobal = currentPage?.scope === "global";
  const selectedEvent = events.find((event) => event.id === eventId);
  const scopeLabel = ready ? selectedEvent?.name ?? "งานวิ่งทั้งหมด" : "กำลังโหลดงาน…";
  const waiting = orders.filter(
    (order) =>
      order.status === "slip_uploaded" &&
      (eventId === "all" || order.eventId === eventId),
  ).length;
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
  function renderNavigation(scope: "event" | "global") {
    return navigation
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
        {href === "/slips" && ready && waiting > 0 && (
            <span
              className="nav-count"
              aria-label={`${waiting} รายการรอตรวจในงานที่เลือก`}
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
        ข้ามไปยังเนื้อหา
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
        <div className="workspace-label">
          <label className="workspace-caption" htmlFor="event-scope">
            เลือกงานที่ต้องการจัดการ
          </label>
          <div className="workspace-selector">
            <Flag size={17} aria-hidden="true" />
            <select
              id="event-scope"
              disabled={!ready}
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              aria-describedby="event-scope-hint"
              title={scopeLabel}
            >
              <option value="all">งานวิ่งทั้งหมด</option>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <span className="workspace-selected" aria-hidden="true">{scopeLabel}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
          <p id="event-scope-hint" className="workspace-hint">
            {eventId === "all"
              ? "ดูข้อมูลรวมทุกงานวิ่ง"
              : "ดูข้อมูลเฉพาะงานที่เลือก"}
          </p>
        </div>
        <p className="nav-label" id="event-navigation-label">
          ข้อมูลตามงานที่เลือก
        </p>
        <nav aria-labelledby="event-navigation-label">
          {renderNavigation("event")}
        </nav>
        <p className="nav-label nav-section-label" id="global-navigation-label">
          ส่วนกลาง · ทุกงาน
        </p>
        <nav aria-labelledby="global-navigation-label">
          {renderNavigation("global")}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="demo-indicator" />
            พื้นที่สาธิต
            <p>
              ทดลองจัดการด้วยข้อมูลตัวอย่าง
              <br />
              ข้อมูลบันทึกในเบราว์เซอร์นี้
            </p>
            <button onClick={() => setHelpOpen(true)}>
              เกี่ยวกับเวอร์ชันนี้ <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            className="nav-item help-button"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={19} aria-hidden="true" />
            คำแนะนำการใช้งาน
          </button>
          <Link className="profile" href="/login">
            <span className="avatar">AD</span>
            <span>
              <strong>ผู้ดูแลระบบ</strong>
              <small>บัญชีสาธิต</small>
            </span>
            <LogOut size={17} aria-hidden="true" />
          </Link>
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
              {isGlobal ? "ส่วนกลาง" : "ข้อมูลตามงานที่เลือก"}
            </span>
            <ChevronRight size={15} aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className="scope-indicator"
              title={
                isGlobal
                  ? "หน้านี้แสดงข้อมูลส่วนกลาง ไม่ขึ้นกับงานที่เลือก"
                  : scopeLabel
              }
            >
              {isGlobal ? (
                <ShieldCheck size={16} aria-hidden="true" />
              ) : (
                <Flag size={16} aria-hidden="true" />
              )}
              <span>{isGlobal ? "ข้อมูลส่วนกลาง" : scopeLabel}</span>
            </span>
            <span className="demo-pill">ข้อมูลสาธิต</span>
            <span className="avatar small" aria-label="ผู้ดูแลระบบสาธิต">
              AD
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {ready ? children : <p className="context-loading" role="status">กำลังโหลดพื้นที่ทำงาน…</p>}
        </main>
        <footer className="page-footer">
          <span>
            RunOps <span aria-hidden="true">/</span> ระบบจัดการงานวิ่ง
          </span>
          <span>เวอร์ชันสาธิต · ยังไม่เชื่อมต่อ API</span>
        </footer>
      </div>
      {helpOpen && (
        <Modal
          title="ยินดีต้อนรับสู่ RunOps"
          onClose={() => setHelpOpen(false)}
        >
          <div className="modal-body prose">
            <p>
              พื้นที่นี้เป็นต้นแบบหน้าจอสำหรับผู้ดูแลระบบ
              สามารถทดลองสร้างงานวิ่ง ค้นหาออเดอร์ ตรวจสลิป และส่งออกรายงาน CSV
              ได้
            </p>
            <p>
              ข้อมูลทั้งหมดเป็นข้อมูลสมมติและบันทึกเฉพาะในเบราว์เซอร์
              ไม่มีการรับเงิน ส่งพัสดุ หรือสร้างบัญชีผู้ใช้จริง
            </p>
            <p>
              เลือกงานวิ่งที่ sidebar เพื่อดูภาพรวม ออเดอร์ สลิป ผู้สมัคร
              การจัดส่ง และรายงานของงานนั้น
              เมนูส่วนกลางใช้จัดการงานวิ่งทั้งหมดและผู้ใช้
              โดยไม่ขึ้นกับงานที่เลือก
              การตรวจสอบสิทธิ์และระบบล็อกอินจะเชื่อมต่อกับ backend ในขั้นถัดไป
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() => setHelpOpen(false)}
            >
              เริ่มใช้งาน
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
