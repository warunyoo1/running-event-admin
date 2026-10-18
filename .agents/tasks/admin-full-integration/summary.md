สรุปงาน admin-full-integration

FEAT-001 Event (API + หน้า /events)
- ลบถาวร, archive/restore, ส่ง null เพื่อล้างค่า (registrationEnds, category/theme, เวลาเริ่มแข่ง)
- กันลบเมื่อมี order (EVENT_HAS_ORDERS) หรือมีโควตาถูกจอง (EVENT_QUOTA_RESERVED)
- event ที่ archive แล้วไม่แสดงฝั่ง public

FEAT-002 User (API + หน้า /users)
- deactivate, ลบอย่างปลอดภัย (ต้อง deactivate ก่อน, ห้ามลบถ้ามีประวัติ), สร้างด้วยรหัสผ่านชั่วคราว (mustChangePassword), แก้อีเมล
- กันแก้/ลบตัวเอง: CANNOT_MODIFY_SELF, CANNOT_DELETE_SELF

FEAT-003 Order (API + order-detail)
- โน้ตภายใน (OrderNote, สูงสุด 100 ต่อ order, 1000 ตัวอักษร), timeline, แก้ที่อยู่จัดส่ง (บันทึก audit before/after), ชื่อผู้ตรวจสลิป
- approve/reject/cancel คืน order detail เต็ม
- ไฟล์ใหม่: order-address-form, order-notes, order-timeline

FEAT-004 Audit log (API + หน้า /audit-logs)
- เฉพาะ super_admin, แบ่งหน้า, ใหม่สุดก่อน, filter action/entity/entityId/userId/from-to

FEAT-005 Shipping / Export / กวาด control ที่ไม่ทำงาน
- ค้นหา shipping ฝั่ง server (ชื่อ, BIB, orderNo, เบอร์, tracking)
- CSV: fulfillment (q), overview.csv, shirt-sizes.csv (UTF-8 BOM)
- ลบ client-csv.ts ที่เป็นของปลอมฝั่ง client

Tests ที่เพิ่ม (API): audit-log, export-rows, order-state, shipping-search, user-rules, validators, views/order-timeline และแก้ views/order.view
ผลล่าสุด: API typecheck, 195 tests (18 ไฟล์), build ผ่าน; admin typecheck และ build ผ่าน

ตรวจจริง (live)
- mongod 7.0.12 ชั่วคราว (ไม่มี replSet) + API port 4010 รันสคริปต์ 137 assertions ผ่านทั้งหมด ครอบคลุม event/user/note/address/timeline/audit/shipping/CSV/dashboard
- เก็บกวาดแล้ว: สคริปต์ชั่วคราว, db dir, uploads, process
ยังไม่ได้ตรวจ
- UI ฝั่ง admin ในเบราว์เซอร์ (ตรวจแค่ typecheck/build)
- timeline: entry 'paid' อาจเรียงก่อน 'slip_uploaded' ใน seed data เพราะ createdAt ของ Payment คือเวลา seed

OPEN DECISIONS (plan.md ข้อ 2)
- O1 dashboard ยังรวม races/orders ของ event ที่ archive (ไม่เปลี่ยนโดยตั้งใจ)
- O2 การค้นหา shipping ต้องใช้ MongoDB 5.0+ เพราะใช้ $lookup แบบ localField+pipeline (README ระบุแล้ว)
- O3 Order model มี transactionRef จริง timeline ตาม amendment (ใช้ Payment ถ้ามี ไม่งั้น null)
- O4 ห้าม demote ตัวเอง ถูกบล็อกด้วย CANNOT_MODIFY_SELF
- O5 ไม่ได้ commit ใดๆ (ไม่ git add/commit/push)
