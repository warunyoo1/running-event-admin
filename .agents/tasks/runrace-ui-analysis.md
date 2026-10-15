# วิเคราะห์ runrace.in.th เพื่อออกแบบระบบหลังบ้าน (Back-office)

วันที่ตรวจสอบ: ตรวจจากเว็บจริงด้วย Playwright (Chromium headless) ติดตั้งในโฟลเดอร์ temp นอกโปรเจกต์ ไม่แก้ไฟล์ในโปรเจกต์ ไม่ได้กดยืนยันการสมัคร ไม่ได้ชำระเงิน ไม่ได้ล็อกอิน

## 1. สรุปคำตอบ

runrace.in.th เป็น SPA (Vue + Vue Router, bundle `/js/app.3ecf0059.js`, `chunk-vendors`) แบบ "แพลตฟอร์มรับสมัครงานวิ่งหลายผู้จัด (multi-organizer SaaS)" ดำเนินการโดย RUNNING DIGITAL SOLUTION CO., LTD. หน้าบ้านที่เห็นมีแค่ส่วนผู้สมัคร แต่ route ใน bundle ยืนยันว่ามีหลังบ้านอย่างน้อย 3 ระดับ คือ Admin แพลตฟอร์ม, Organizer (ผู้จัดงาน) และ Member

ระบบหลังบ้านที่จำเป็น (เรียงตามความสำคัญ):
- MVP: จัดการงานวิ่ง (event + ระยะ/ราคา/ไซซ์เสื้อ/โควตา), จัดการออเดอร์และผู้สมัคร (ค้นหา/export), ตรวจสอบการชำระเงิน (PromptPay + บัตร Omise), ระบบล็อกอินและสิทธิ์ (admin/organizer), รายงานสรุป/Export, จัดการการรับอุปกรณ์/จัดส่ง
- ถัดไป: คำขอคืนเงิน, สมัครแบบ offline/หน้างาน, QR check-in รับ BIB, ตรวจรายชื่อ/เลข BIB, แก้ไขใบสมัคร, dashboard realtime
- ภายหลัง: lucky draw, สัญญา/contract ผู้จัด + ค่าธรรมเนียมแพลตฟอร์ม, เนื้อหา CMS (terms/คู่มือ), หลายภาษา, audit log

## 2. หลักฐานที่สังเกตได้ (page by page)

### 2.1 ที่ยืนยันได้จากการเปิดหน้าจริง

| URL | สิ่งที่เห็น | นัยต่อหลังบ้าน |
|---|---|---|
| `/` | เมนู กิจกรรม / ขั้นตอนการสมัคร / ค้นหาใบสมัคร / เกี่ยวกับเรา, สลับภาษา ไทย/EN, ปุ่ม login, รายการงานประมาณ 55 งาน เรียงวันที่จัดมากไปน้อย แต่ละงานมีสถานะ "เปิดรับสมัคร/ปิดรับสมัครแล้ว", ชื่อ, วันที่, สถานที่ | ต้องมี CRUD งาน, สถานะเปิด/ปิดรับ, เรียงลำดับ/แสดงหน้าแรก |
| `/{event_key}` เช่น `/nsr2027` | หน้างาน: ชื่อ, วันที่, สถานที่, คำอธิบายยาว (rich text/อีโมจิ, ไฮไลต์, ระยะ+เวลาปล่อยตัว, สิทธิประโยชน์, จุดรับอุปกรณ์, ค่าจัดส่ง +50 บาท), ผู้จัดงาน, ช่องทางติดต่อ, ปุ่ม "สมัครเข้าร่วมกิจกรรม" และ "ตรวจสอบรายชื่อ" | ต้องมี editor เนื้อหางาน, ข้อมูลผู้จัด, slug/event_key ที่ไม่ซ้ำ, อัปโหลดรูป/โปสเตอร์ |
| `/{event_key}/register` | ฟอร์มสมัครแบบหลายคนต่อ 1 ออเดอร์ (ดูข้อ 3) ตัวขั้นตอน 4 ขั้น: ข้อมูลผู้สมัคร → ข้อมูลที่อยู่ → ชำระเงิน → เสร็จสมบูรณ์ | ต้องกำหนดฟอร์ม/ตัวเลือกต่อ event และดูออเดอร์ |
| `/{event_key}/check` | ค้นหารายชื่อผู้สมัครด้วย: เลขบัตรประชาชน / เบอร์โทร / ชื่อ (radio 3 แบบ) | ต้องมี API/หน้าค้นหาผู้สมัครที่ผูกกับ event, ควบคุมข้อมูลส่วนบุคคลที่แสดงสาธารณะ |
| `/find-order` | ค้นหาใบสมัครด้วยเบอร์โทร (ช่อง "Mobile No") | ต้องมีการค้นหาออเดอร์ตามเบอร์ในหลังบ้านเช่นกัน |
| `/auth/login` | อีเมล + รหัสผ่าน + Remember password (ไม่มีปุ่มสมัครสมาชิกที่หน้าบ้าน) | บัญชีผู้ใช้หลังบ้านแบบ admin สร้างให้ ต้องมีจัดการ user/role |
| `/about` | ข้อความขายบริการ (รองรับ Free Registration และ Standard Registration, ระบบลงทะเบียน, ระบบชำระเงิน, รายงานสรุปผล), ช่องทางติดต่อ Line/Facebook/Email/โทร | ยืนยันว่าเป็นบริการ SaaS ให้ผู้จัด มีทั้งงานฟรีและงานเสียเงิน |
| `/terms-of-use` | รวม ข้อตกลง / PDPA / นโยบายคืนเงิน (anchor `#terms #refund #privacy`) ระบุว่าเก็บข้อมูล ชื่อ ติดต่อ ยืนยันตัวตน สุขภาพ ขนาดเสื้อ หลักฐานชำระเงิน, ผู้ใช้ขอเข้าถึง/แก้ไข/ลบข้อมูลได้ทางอีเมล, การคืนเงินเป็นไปตามประกาศแต่ละงาน | ต้องมีกระบวนการคำขอ PDPA (ลบ/แก้ไขข้อมูล), นโยบายคืนเงินต่อ event, retention |
| `/how-to-register`, `/how-to-use-admin` | คู่มือแบบรูปภาพ; หน้า admin guide มี 4 ขั้น: เข้าสู่ระบบผู้ดูแล, เข้าหน้าระบบ RUNRACE, Export รายงานผู้สมัคร, รายงานอื่น ๆ | ยืนยันตรง ๆ ว่ามี "ระบบผู้ดูแล" ที่ล็อกอินแล้ว Export รายงานผู้สมัครได้ |
| footer | ลิงก์ "ผู้จัดกิจกรรม" (เปิดแท็บใหม่ แต่ href เป็น `#` ซึ่งยังไม่ชัดว่าไปไหน), ค้นหาใบสมัคร, ข้อมูลบริษัท RUNNING DIGITAL SOLUTION CO., LTD. | ช่องทางสมัครเป็นผู้จัด/onboarding organizer (ยังไม่ได้พิสูจน์ว่าทำงานอย่างไร) |

หมายเหตุ: ลิงก์ `/terms`, `/refund`, `/privacy`, `/organizer` ที่ผมลองเดาให้ 404 ซึ่งปกติ (ลิงก์จริงอยู่ที่ `/terms-of-use#...`) ส่วน `GET /v1/events/initial/{terms|refund|privacy|organizer}` ถูกเรียก แต่ได้ผลลัพธ์ body ว่าง `[]` (ตรวจ `/events/initial/nsr2027` ตอนจับ response ที่ได้ได้ `{"status":"success","body":[]}` ซึ่งอาจเป็นเพราะ response ถูกจับตอนเรียก path ที่ไม่ใช่งานจริง ไม่ใช่ข้อสรุปว่า API ว่างเปล่า)

### 2.2 ฟอร์มสมัคร `/nsr2027/register` (ที่อ่านจาก DOM จริง)

ข้อมูลผู้สมัคร (ต่อคน):
- ชื่อ (ไม่ต้องมีคำนำหน้า)*, นามสกุล*, เพศ* (ชาย/หญิง)
- วันเกิด (วัน 1-31)*, เดือน*, ปีเกิด พ.ศ. (ช่วง 2477-2567)*
- สัญชาติ* (ไทย / อื่น ๆ)
- เลขบัตรประชาชน/พาสปอร์ต + checkbox "ไม่ประสงค์ให้ข้อมูล" (hide_info)
- อีเมล (ไม่บังคับ), เบอร์โทร*
- ปัญหาสุขภาพ/แพ้อาหาร/แพ้ยา (ไม่บังคับ), หมู่เลือด* (A/B/AB/O/Other)
- ผู้ติดต่อฉุกเฉิน*: ชื่อ, ความสัมพันธ์, เบอร์โทร
- ประเภทการแข่งขัน* (ดรอปดาวน์ แสดงระยะ + ราคา + ของที่ได้ เช่น "5 KM ราคา: 399 THB เสื้อ,บิบ,เหรียญ", "10 KM ราคา: 499 THB")
- ขนาดเสื้อ* (XS-4XL พร้อมรอบอก/ความยาว เช่น "XS (รอบอก 34 ยาว 26)")
- จังหวัดที่อยู่ปัจจุบัน* (77 จังหวัด + ต่างประเทศ)
- ชื่อทีม (ไม่บังคับ)
- ปุ่ม "เพิ่มข้อมูลผู้สมัคร" ข้อความระบุว่าเพิ่มผู้สมัครได้สูงสุด 20 คนต่อออเดอร์ มีปุ่มเพิ่มเติม/แก้ไขต่อรายการ

ระดับออเดอร์:
- การรับเสื้อและบิบ*: "ขนส่งเอกชน" หรือ "รับด้วยตนเอง" (มีข้อมูลที่อยู่จัดส่ง อ้างอิง API ที่อยู่/จังหวัด/อำเภอ/ตำบล)
- ช่องทางชำระเงิน*: พร้อมเพย์ (ค่าธรรมเนียมออนไลน์ 3%) และ บัตรเครดิต/เดบิต (ค่าธรรมเนียม 5%)
- checkbox ยอมรับเงื่อนไข
- ปุ่มสร้างออเดอร์จะปรากฏหลังเพิ่มผู้สมัครอย่างน้อย 1 คน

เมื่อเปิดหน้าสมัครมีการเรียก `POST /v1/order/check-participate-limit` ด้วย body `{"event_key":"nsr2027","language":"TH"}` แสดงว่ามีกลไกจำกัดจำนวนผู้สมัคร (โควตา)

### 2.3 ที่พบจาก bundle (ไม่ได้เปิดหน้าจริง ต้องล็อกอิน)

Route ที่อ่านจาก `app.3ecf0059.js` (regex `path:"..."`):
- สาธารณะ: `/`, `/about`, `/find-order`, `/how-to-register`, `/how-to-use-admin`, `/terms-of-use`, `/o/:q`, `/order/:q`, `/order-update/:event_key/:uuid`, `/404`
- ต่อ event: `:event_key/register`, `:event_key/registerdd`, `:event_key/register/offline`, `:event_key/check`, `:event_key/participant`, `:event_key/qr`, `:event_key/realtime`, `:event_key/refund`
- Auth/Member: `auth/login`, `auth/register`, `profile`, `dashboard`
- Admin: `dashboard-admin`, `dashboard-admin/:event_key`, `dashboard-admin-utils`, `checkbib-organizer/:event_key`
- Organizer: `dashboard-organizer`, `dashboard-organizer/:event_key`, `.../edit`, `.../contract`, `.../lucky-draw`

API endpoint ที่พบใน bundle (ชื่อ path เท่านั้น ไม่ได้ทดสอบเรียก และไม่ทราบ schema): `/v1/auth/login`, `/v1/auth/profile`, `/v1/user/register`, `/v1/events`, `/v1/events/initial/`, `/v1/events-perf/`, `/v1/member-event/order`, `/v1/order/{create, create-free, update, amount, address, cc-payment, inquiry, find-order, event-check, event-refund, refund-request, refund-completed, check-participate-limit, check-participate-limit-free, is_exiting_runner}`, `/v1/participant/check`, `/v1/utils/{province, district, sub-district, run-model}`

Host ของ API: `https://runraceapi.ishootrun.com` (ใช้ร่วมกับ ishootrun.in.th, ซึ่งปรากฏเป็นงานในรายการ "สั่งจองเสื้อ iSHOOTRUN 2026")
Payment SDK: `https://cdn.omise.co/omise.js` (Omise) นอกจากนี้ใช้ Google Analytics (gtag) และ Cloudflare

## 3. Data entities และฟิลด์ที่ควรมี (อนุมานจาก UI)

หมายเหตุ: ชื่อฟิลด์เป็นข้อเสนอของผม ไม่ใช่ schema จริงของเว็บนั้น

- User/Account: id, email, password_hash, role (platform_admin / organizer / member), status, ชื่อ
- Organizer: id, ชื่อผู้จัด, ช่องทางติดต่อ (โทร/Line/Facebook/อีเมล), ข้อมูลบริษัท/ภาษี, สัญญา
- Event: id, event_key (slug ไม่ซ้ำ), ชื่อ (TH/EN), วันที่จัด, สถานที่, คำอธิบาย (rich text), รูป/โปสเตอร์, สถานะ (draft/open/closed), วันเปิด-ปิดรับ, ประเภทงาน (ฟรี/เสียเงิน/ออนไลน์), จำกัดผู้สมัครรวม, เงื่อนไขการคืนเงิน, ผู้จัด
- Race/Distance (ต่อ event): ชื่อระยะ, ราคา, ของที่ได้ (เสื้อ/บิบ/เหรียญ), เวลาปล่อยตัว, โควตา, ช่วงอายุ/รุ่น (อนุมาน), ชนิด (วิ่ง/เดิน/ปั่น เพราะมีงาน Bike Rally)
- Shirt size (ต่อ event): ชื่อไซซ์, รอบอก, ความยาว, สต็อก/โควตา
- Order: id, order_no/uuid, event_id, ผู้ติดต่อ, วิธีรับของ (ส่ง/รับเอง), ที่อยู่จัดส่ง (จังหวัด/อำเภอ/ตำบล), ค่าจัดส่ง, ค่าธรรมเนียมชำระเงิน, ยอดรวม, ช่องทางชำระ, สถานะ (pending/paid/expired/refunded)
- Participant/Registration: ข้อมูลตามข้อ 2.2 + race_id, shirt_size, team, bib_no, สถานะรับของ/check-in
- Payment: order_id, provider (PromptPay/Omise card), charge_id, amount, fee, status, paid_at, หลักฐาน
- Refund: order_id, เหตุผล, สถานะ (requested/approved/completed), ผู้อนุมัติ, วันที่ (จาก `refund-request`, `refund-completed`)
- Shipment/Pickup: ที่อยู่, ผู้ให้บริการ, tracking (อนุมาน; UI เห็นแค่ตัวเลือกขนส่งเอกชน)
- Lucky draw (ผู้จัด), Contract (ผู้จัด) ตาม route
- Content page: terms/refund/privacy/organizer (จาก `events/initial/{terms,refund,privacy,organizer}`)
- Master data: จังหวัด/อำเภอ/ตำบล, run-model (`/v1/utils/run-model` ไม่ทราบความหมายแน่ชัด)

## 4. โมดูลหลังบ้านที่แนะนำ

### MVP (ขาดไม่ได้ ให้ระบบเปิดรับสมัครได้จริง)

| โมดูล | หลักฐาน UI |
|---|---|
| 1. Auth & Role (admin แพลตฟอร์ม / organizer / member) | `/auth/login`, route `dashboard-admin`, `dashboard-organizer`, คู่มือ `/how-to-use-admin` |
| 2. จัดการงาน (Event CRUD + status เปิด/ปิดรับ + rich-text + รูป + slug) | รายการงานบน `/`, หน้า `/{event_key}`, `dashboard-organizer/:event_key/edit` |
| 3. ตั้งค่าระยะ/ราคา/ของที่ได้/ไซซ์เสื้อ/โควตา | dropdown ประเภทการแข่งขัน และขนาดเสื้อ, `check-participate-limit` |
| 4. จัดการออเดอร์และผู้สมัคร (ค้นหา ตามชื่อ/เบอร์/เลขบัตร, ดู/แก้ไข, ยกเลิก) | `/find-order`, `/{event_key}/check`, `/{event_key}/participant`, `order-update/:event_key/:uuid` |
| 5. ชำระเงินและกระทบยอด (PromptPay, บัตร Omise, ค่าธรรมเนียม 3%/5%, สถานะ, webhook, ออเดอร์หมดอายุ) | ตัวเลือกชำระเงินในฟอร์ม, omise.js, `/v1/order/{cc-payment, inquiry}` |
| 6. รายงานและ Export (รายชื่อผู้สมัคร, สรุปยอดขาย, สรุปไซซ์เสื้อต่อระยะ) | คู่มือ admin ข้อ "Export รายงานผู้สมัคร" และ "รายงานอื่น ๆ", ข้อความ "รายงานสรุปผล" ใน `/about` |
| 7. จัดการการรับอุปกรณ์/จัดส่ง (ส่ง/รับเอง, รายการที่อยู่, ค่าจัดส่ง) | ตัวเลือก "ขนส่งเอกชน/รับด้วยตนเอง" และค่าส่ง +50 บาท ในหน้างาน |

### ถัดไป (Next)

| โมดูล | หลักฐาน UI |
|---|---|
| 8. คืนเงิน/ยกเลิก (workflow ขอ → อนุมัติ → คืนเงินแล้ว) | route `:event_key/refund`, API `refund-request`, `refund-completed`, `event-refund`, นโยบายคืนเงิน |
| 9. สมัครหน้างาน/offline และผู้จัดกรอกแทน | route `:event_key/register/offline` |
| 10. BIB: กำหนดเลข BIB, ตรวจ BIB, QR check-in รับอุปกรณ์ | route `checkbib-organizer/:event_key`, `:event_key/qr` |
| 11. Dashboard เรียลไทม์ (ยอดสมัคร, รายได้, เหลือโควตา) | route `:event_key/realtime`, `dashboard-admin/:event_key` |
| 12. งานฟรี (Free Registration) และกฎ duplicate/ผู้เคยวิ่ง | `/about`, API `create-free`, `check-participate-limit-free`, `is_exiting_runner` |
| 13. คำขอ PDPA (ขอแก้ไข/ลบข้อมูล), ซ่อนเลขบัตร | `/terms-of-use`, checkbox "ไม่ประสงค์ให้ข้อมูล" |
| 14. การแจ้งเตือน (อีเมล/SMS/Line ยืนยันการสมัคร) | มีอีเมล+เบอร์ในฟอร์ม (หลักฐานโดยอ้อม ไม่ได้เห็นการส่งจริง) |

### ภายหลัง (Later)

| โมดูล | หลักฐาน UI |
|---|---|
| 15. Lucky draw | route `dashboard-organizer/:event_key/lucky-draw` |
| 16. สัญญา/ค่าธรรมเนียมแพลตฟอร์ม, การโอนเงินให้ผู้จัด (settlement) | route `dashboard-organizer/:event_key/contract` (เนื้อหาไม่ทราบ ต้องล็อกอิน) |
| 17. CMS (terms, คู่มือ, หน้าผู้จัด), หลายภาษา TH/EN | ปุ่ม ไทย/EN, `/how-to-*`, `events/initial/terms` |
| 18. Audit log, ผลการแข่งขัน/เวลาวิ่ง, ตั้งค่าบริษัท (`dashboard-admin-utils`) | ไม่พบ UI ผลวิ่ง; ส่วนนี้เป็นข้อเสนอเสริม ไม่มีหลักฐานจากเว็บ |

## 5. ข้อจำกัด

- ไม่ได้ล็อกอิน จึงไม่เห็นหน้า dashboard admin/organizer จริง รายการโมดูล 8-16 อ้างอิงจากชื่อ route และ API ใน bundle เท่านั้น ไม่ทราบหน้าตาหรือฟังก์ชันจริง
- ไม่ได้กดยืนยันการสมัคร จึงไม่เห็นขั้น "ข้อมูลที่อยู่", "ชำระเงิน" (QR PromptPay/ฟอร์มบัตร) และ "เสร็จสมบูรณ์" ไม่ทราบอีเมล/SMS ที่ส่ง และไม่ทราบสถานะออเดอร์จริง
- ดูฟอร์มสมัครแค่งานเดียว (`nsr2027`) งานอื่นอาจมีฟิลด์/ตัวเลือกต่างกัน (เช่น งานฟรี งานปั่นจักรยาน งานจองเสื้อ) ระบบน่าจะตั้งค่าได้ต่อ event แต่ไม่ได้ยืนยัน
- ไม่ได้อ่านโครงสร้าง response ของ API จึงไม่ทราบ schema ฐานข้อมูลจริง ชื่อ entity/field ในข้อ 3 เป็นข้อเสนอ
- ผลจากการดึง `events/initial/...` ที่ได้ body ว่างยังตีความไม่ได้ ไม่ควรสรุปว่าผู้จัดงานหรือ terms เก็บใน API นั้น
- ลิงก์ "ผู้จัดกิจกรรม" ใน footer มี href เป็น `#` ไม่ทราบว่าเปิดอะไร
- รายการงาน ณ เวลาที่ตรวจมีประมาณ 55 งาน จำนวนอาจเปลี่ยนไป
- ระยะ/ราคา/ค่าธรรมเนียม ที่อ้างเป็นของงาน `nsr2027` ณ เวลาที่ตรวจ

## 6. ข้อเสนอแนะ

1. เริ่มจากโมดูล 1-7 และใช้ Event → Race → Order → Participant → Payment เป็นแกนข้อมูล
2. ออกแบบให้ multi-tenant ตั้งแต่ต้น (Organizer เห็นเฉพาะงานของตัวเอง, Admin แพลตฟอร์มเห็นทั้งหมด)
3. เก็บข้อมูลอ่อนไหว (เลขบัตร, ข้อมูลสุขภาพ) แบบเข้ารหัส/จำกัดสิทธิ์ และปิดบังในหน้าค้นหาสาธารณะ ตามที่เว็บอ้าง PDPA
4. ถ้าต้องการยืนยันหน้า admin จริง ให้ขอบัญชีทดลองจากผู้ให้บริการ (Line @892llvwo / info@runrace.in.th) หรือขอ screenshot คู่มือ `/how-to-use-admin` แล้วนำมาปรับ scope
