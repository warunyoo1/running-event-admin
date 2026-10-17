import Link from "next/link";
import { Suspense } from "react";
import { Flag, ScanLine, Users } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ | RunOps" };
export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-story">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Flag size={23} aria-hidden="true" />
          </span>
          <span>
            run<span className="brand-ops">ops</span>
          </span>
        </Link>
        <div>
          <span className="login-kicker">เบื้องหลังงานวิ่งที่ราบรื่น</span>
          <h1>
            ทุกก้าวของผู้สมัคร
            <br />
            เริ่มที่ทีมของคุณ
          </h1>
          <p>
            จัดการงานวิ่ง ดูแลผู้สมัคร และติดตามการชำระเงิน
            <br />
            ผ่านพื้นที่ทำงานเดียวที่เข้าใจง่าย
          </p>
          <div className="login-benefits">
            <span>
              <Users size={18} aria-hidden="true" />
              ข้อมูลผู้สมัครเป็นระเบียบ
            </span>
            <span>
              <ScanLine size={18} aria-hidden="true" />
              ตรวจสลิปได้สะดวก
            </span>
          </div>
        </div>
        <small>RunOps · ระบบจัดการงานวิ่ง</small>
      </div>
      <div className="login-form">
        <div>
          <h2>เข้าสู่ระบบ</h2>
          <p>
            ใช้บัญชีผู้ดูแลระบบของคุณ
            <br />
            เพื่อจัดการงานวิ่งและตรวจสอบการชำระเงิน
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
