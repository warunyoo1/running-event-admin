import Link from "next/link";
import { Flag } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found">
      <title>ไม่พบหน้า | RunOps</title>
      <Flag size={40} aria-hidden="true" />
      <p>404</p>
      <h1>ไม่พบหน้าที่คุณต้องการ</h1>
      <p>ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ยังไม่เปิดใช้งาน</p>
      <Link className="button primary" href="/">
        กลับไปหน้าภาพรวม
      </Link>
    </main>
  );
}
