# NE2 Network Dashboard

ระบบตรวจสอบสถานะอุปกรณ์เครือข่ายภายในสำนักงาน **การไฟฟ้าส่วนภูมิภาค เขต 2 (กฟฉ.2)** — แผนกคอมพิวเตอร์และเครือข่าย

เริ่มต้นเป็นระบบ network monitoring (ping/latency/uptime) แล้วขยายเพิ่มโมดูลจัดการงบประมาณ, จัดการงาน (job/site), และจัดการอุปกรณ์สำนักงาน (แยกจากอุปกรณ์เครือข่าย) เข้ามารวมในแอปเดียว

## Tech Stack

- **React 19 + Vite 8** — SPA, ไม่ใช้ react-router (มีระบบ routing ที่เขียนเองใน `App.jsx`)
- **recharts** — กราฟทั้งหมด (Bar/Area/Composed chart)
- **framer-motion** — page transition และ animation
- **react-hot-toast** — แจ้งเตือน
- **lucide-react** — icon set
- **html2pdf.js** — export PDF (ตารางอุปกรณ์, รายงานสถานะ)
- **ไม่มี backend ใน repo นี้** — เป็น frontend ล้วน เรียก REST API ภายนอกผ่าน `VITE_API_BASE_URL`

## เริ่มต้นใช้งาน

```bash
npm install
npm run dev      # dev server (HMR)
npm run build    # production build
npm run lint      # eslint
```

ต้องตั้งค่าไฟล์ `.env`:

```
VITE_API_BASE_URL=http://<backend-host>:<port>
```

## โครงสร้างโปรเจกต์

โครงสร้างค่อนข้างแบน — component ส่วนใหญ่อยู่ที่ `src/components/*.jsx` ไฟล์ละ 1 หน้า/ฟีเจอร์ ไม่มี state management library (Redux/Zustand) ใช้ `useState`/`useEffect` ตรงๆ

| ไฟล์ | หน้าที่ |
|---|---|
| `App.jsx` | root component + ระบบ routing ทั้งหมด (ดูหัวข้อ Routing ด้านล่าง) |
| `Sidebar.jsx` | เมนูข้าง + System Status widget (Total/Online/Down) + ปุ่มยุบ/แสดงเมนู |
| `StatsGrid.jsx`, `NetworkChart.jsx`, `DeviceTable.jsx` | หน้า dashboard หลัก (สถิติรวม, กราฟ latency, Top 10 latency ต่ำสุด) |
| `Devices.jsx`, `DeviceDetails.jsx`, `NetworkDeviceManagement.jsx` | รายการ/รายละเอียด/CRUD อุปกรณ์เครือข่าย (ping monitoring) |
| `DownDevices.jsx`, `DowntimeHistory.jsx` | อุปกรณ์ที่ offline ตอนนี้ / ประวัติการขัดข้อง |
| `Analytics.jsx` | Speedtest (ping/download/upload) + IP/endpoint diagnostics |
| `BudgetDashboard.jsx`, `BudgetManagement.jsx` | ภาพรวม/CRUD งบประมาณ + อัปโหลด transaction จาก Excel/CSV |
| `JobReport.jsx` | หน้า "แจ้งปัญหา" สาธารณะ (ไม่ต้อง login เพื่อดู) — แจ้งงานใหม่ (ต้อง login) + ติดตามสถานะ |
| `JobManagement.jsx` | หน้าหลังบ้าน (ใน "การจัดการ") สำหรับประมวลผลงานตามสถานะ: เปิดงาน → ระหว่างดำเนินการ → เสร็จงาน / ยกเลิก — แต่ละแถวมีปุ่มดูประวัติ/แก้ไข/ลบ (สิทธิ์ต่างกันตาม role) |
| `JobFormModal.jsx` | ฟอร์มแจ้งงาน/แก้ไขงาน ใช้ร่วมกันทั้ง `JobReport.jsx` (สร้าง) และ `JobManagement.jsx` (แก้ไข) — ฟิลด์ที่แก้ไขได้ต่างกันตาม role เมื่อแก้ไขงานที่มีอยู่แล้ว |
| `JobHistoryModal.jsx` | ประวัติ/audit log ของงาน (`GET /:id/history`) เปิดจากปุ่มไอคอนในแต่ละแถวของ `JobManagement.jsx` |
| `EquipmentPicker.jsx` | ตัวเลือกอุปกรณ์แบบค้นหา+เลือกหลายชิ้น ใช้ทั้งอุปกรณ์ที่มีปัญหา (ตอนเปิดงาน) และอุปกรณ์ที่ใช้ดำเนินการ (ตอนปิดงาน) |
| `BudgetTransactionPicker.jsx` | ค้นหา+เลือกธุรกรรมงบประมาณที่มีอยู่แล้วเพื่อผูกกับงาน ใช้ในหน้าต่างปิดงานของ `JobManagement.jsx` |
| `Management.jsx`, `OfficeEquipmentManagement.jsx` | หน้ารวมเมนูจัดการ + จัดการอุปกรณ์สำนักงาน (คอมพิวเตอร์/ปริ้นเตอร์ ฯลฯ แยกจากอุปกรณ์เครือข่าย) |
| `AdminSettings.jsx` | จัดการผู้ใช้ระบบ |
| `Auth.jsx`, `SsoCallback.jsx` | login/register ปกติ + PEA SSO (ดู [SSO.md](SSO.md)) |
| `About.jsx` | สถิติการเข้าใช้งานเว็บ + คู่มือการใช้งานระบบแบบละเอียด (ดู [USER_GUIDE.md](USER_GUIDE.md)) |

## Routing (ทำเองทั้งหมด ไม่ใช้ react-router)

แอปนี้ใช้ระบบ path-based routing ที่เขียนเองใน `App.jsx` — sync กับ URL จริง รองรับปุ่ม back/forward ของเบราว์เซอร์ได้เต็มรูปแบบ ทั้งหน้าใหญ่และ sub-view ในหน้า:

- `TAB_PATHS` — หน้าเมนูหลัก (`/`, `/devices`, `/analytics`, `/security`, ฯลฯ)
- `BUDGET_VIEW_PATHS` — sub-view ของ Budget Dashboard (`/budget-dashboard`, `/budget-dashboard/search`)
- `MGMT_VIEW_PATHS` — sub-view ของ Management รวมถึงการเจาะลึกไปสำนักงานใดสำนักงานหนึ่ง (`/security/computers/:pea_site_id`)
- `/device/:id` — หน้ารายละเอียดอุปกรณ์เครือข่าย

ฟังก์ชันกลาง `navigate(tab, opts)` ทำ 2 อย่างพร้อมกันเสมอ: อัปเดต state และ `pushState` URL ส่วน `popstate` listener จะ apply URL กลับเข้า state โดยไม่ push ซ้ำ (กัน infinite loop)

**ถ้าเพิ่มหน้า/sub-view ใหม่**: ต้องเพิ่ม path mapping ในกลุ่มค่าคงที่ด้านบน + เพิ่ม branch ใน `pathToRoute()` ด้วย ไม่งั้น deep-link/refresh จะตกไปที่ dashboard เป็น fallback

## Session / Auth

- Auto-logout เมื่อไม่มีการใช้งาน 30 นาที (`SESSION_TIMEOUT_MS` ใน `App.jsx`)
- **สำคัญ**: timer หมดอายุ session เป็น in-memory (`setTimeout`) ปิด tab แล้ว timer หาย — ระบบแก้ด้วยการจด `last_activity` ลง `localStorage` ทุกครั้งที่มี activity แล้วเช็คตอนเปิดแอปใหม่ว่าค้างนานเกิน 30 นาทีหรือยัง ถ้าเกินจะเคลียร์ session ทิ้งทันที (ไม่ใช่แค่รอ timer ในหน้าที่เปิดอยู่)
- รองรับ login แบบปกติ (username/password) และ PEA SSO — ดูรายละเอียด flow ที่ [SSO.md](SSO.md)
- Logout ของ SSO user ต่างจาก local user: ต้องเรียก `POST /api/auth/logout` แล้วตามด้วย full-page redirect ไป `GET /api/auth/sso/logout` เพื่อเคลียร์ cookie ฝั่ง Keycloak ด้วย — ระบบจำ provider ไว้ที่ `localStorage.auth_provider` ตอน login สำเร็จ (ดู [SSO.md](SSO.md#logout))
- Role ที่มีในระบบ: `super_admin`, `manager`, `network_admin`, `computer_admin`, `operator` — สิทธิ์แต่ละหน้าเช็คจาก `user.role` ตรงๆ ไม่มี permission table กลาง

## ข้อมูล 2 ชุดที่ยังไม่เชื่อมกัน (สำคัญ ถ้าจะแก้ backend)

- **Network Devices** (`/api/devices`) — อุปกรณ์ที่ ping monitor (gateway, subnet ฯลฯ) มีฟิลด์ `pea_name`/`province` เป็นข้อความอิสระของตัวเอง
- **PEA Sites** (`/api/pea-jobs/sites`) — master table ของสำนักงาน ผูกกับ Budget Jobs และ Office Equipment ผ่าน `pea_site_id`

ทั้งสองฝั่งมีชื่อสำนักงานคล้ายกันแต่**ไม่ได้ join กันในระบบ** ถ้าสะกดไม่ตรงกันหรือแก้ชื่อฝั่งใดฝั่งหนึ่ง ข้อมูลจะเพี้ยนจากกันโดยไม่มีอะไรเตือน ต้องแก้ schema ฝั่ง backend ถ้าต้องการเชื่อมจริง

## API ที่เรียกใช้ (backend แยกนอก repo)

ดึงผ่าน `${VITE_API_BASE_URL}` ทั้งหมด แนบ `Authorization: Bearer <token>` เมื่อ login แล้ว

<details>
<summary>รายการ endpoint แบ่งตามโมดูล (คลิกเพื่อขยาย)</summary>

**Auth**: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/sso/login`, `/api/auth/users`, `/api/auth/users/:id`

**Network / Latency**: `/api/latency/metrics`, `/api/latency/recent`, `/api/latency/summary`, `/api/latency/status-summary`, `/api/latency/down`, `/api/latency/check/:id`, `/api/latency/availability/:id`, `/api/latency/availability-snapshots/:id`

**Devices**: `/api/devices`, `/api/devices/:id`, `/api/devices/:id/downtime`, `/api/devices/downtime/summary`, `/api/devices/downtime/all`

**Clients (LAN scan)**: `/api/clients/device/:id`, `/api/clients/scan/:index`

**Speedtest**: `/api/test/my-ip`, `/api/test/ping-check`, `/api/test/upload`, `/api/test/download`, `/api/test/report`, `/api/test/history`

**Budgets**: `/api/budgets`, `/api/budgets/:id`, `/api/budgets/selectors`, `/api/budgets/summary/:year`, `/api/budgets/upload-transactions`, `/api/budgets/transactions`, `/api/budgets/transactions/selectors`, `/api/budgets/transactions/find`

**PEA Jobs**: `/api/pea-jobs` (GET แบบแบ่งหน้า/filter, POST สร้างงานใหม่ — ต้อง login), `/api/pea-jobs/:id` (GET รายละเอียด; PUT แก้ไข — ฟิลด์ job_name/job_description/job_type/priority/department/requester_*/notification_doc_no แก้ได้ทุก role ใน canManageWorkflow, ส่วน pea_site_id/status/progress_notes/work_order_no/closing_notes/cancelled_reason/notification_doc_file/completion_report_file แก้ได้เฉพาะ super_admin; DELETE ลบงาน — super_admin เท่านั้น), `/api/pea-jobs/:id/history` (GET ประวัติ/audit log ของงาน — role: super_admin/network_admin/computer_admin/operator), `/api/pea-jobs/:id/progress` (PUT, `assignees: [{ name, emp_id }, ...]` รองรับผู้รับผิดชอบหลายคน), `/api/pea-jobs/:id/complete` (PUT, multipart/form-data — `closing_notes` text field required, `completion_report` ไฟล์เดียว รูป/PDF ≤5MB ไม่บังคับ, เก็บไว้ที่ `completion_report_file`), `/api/pea-jobs/:id/cancel` (PUT, บังคับลำดับสถานะ, จำกัด role: super_admin/network_admin/computer_admin/operator), `/api/pea-jobs/:id/notification-doc` (POST, multipart, ไฟล์เดียว รูป/PDF ≤5MB), `/api/pea-jobs/:id/equipment` (POST, บันทึกอุปกรณ์ที่ใช้ดำเนินการ — คนละอันกับ problem_equipment), `/api/pea-jobs/:id/after-photos` (POST, multipart, สูงสุด 5 รูป ≤5MB/รูป), `/api/pea-jobs/transactions` (POST, ผูกธุรกรรมงบประมาณที่มีอยู่แล้วเข้ากับงาน), `/api/pea-jobs/sites`, `/api/pea-jobs/site/:id`

**Office Equipment**: `/api/office-equipment/`, `/api/office-equipment/:id`, `/api/office-equipment/site/:pea_site_id` (ส่ง `network_ip` ของสำนักงานมาด้วย — `main`/`secondary_172`/`secondary_10`/`dhcp_range`; ทั้งสามตัวนี้ยังส่ง `jobs` — งาน PEA Job ที่นำอุปกรณ์นี้ไปใช้ดำเนินการ — และ `problem_jobs` — งานที่แจ้งว่าอุปกรณ์นี้มีปัญหา คือประวัติการซ่อมจริง — แสดงเฉพาะใน `EquipmentDetails.jsx`, ไม่ได้ใส่ในหน้า list), `/api/office-equipment/search` (POST, ไม่ต้อง login — ค้นหาแบบ AND จากฟิลด์ใดก็ได้ผ่าน body แทน query string)

**Stats**: `/api/stats/track`, `/api/stats/summary`

</details>

## จุดที่ควรระวังเวลาแก้โค้ดต่อ (บทเรียนจากที่เจอมาแล้ว)

- **Flexbox/Grid + ข้อความไทยยาวๆ**: ต้องใส่ `min-width: 0` ให้ flex/grid item เสมอ ไม่งั้นข้อความยาวไม่มีช่องว่างจะดันเลย์เอาต์แตกบนจอเล็ก (เจอใน dashboard header)
- **เปรียบเทียบ id ต้องแปลงเป็น string ก่อน**: `deviceId` ที่มาจาก URL (ผ่าน regex) เป็น string เสมอ แต่ตอน id มาจาก object ที่ click (`device.id`) มักเป็น number — เทียบด้วย `===` ตรงๆ จะพลาด ต้อง `String(a) === String(b)`
- **ทดสอบ mobile ด้วย headless Chrome**: flag `--window-size` ไม่ได้ emulate viewport จริง ต้องใช้ CDP `Emulation.setDeviceMetricsOverride` ถึงจะได้ผลลัพธ์ตรงกับที่ผู้ใช้จะเห็นจริง
- **Logout/auto-logout ต้องเคลียร์ state ฝั่ง client ก่อนเสมอ**: อย่า `await` server call ก่อน clear session — ถ้าเน็ตช้า/หลุดตอนนั้นพอดี user จะค้าง ต้อง clear local state + redirect ทันที แล้วค่อยยิง API แจ้ง server แบบ fire-and-forget
- **เพิ่ม/แก้ feature ที่ผู้ใช้ทั่วไปมองเห็น ต้องอัปเดตคู่มือด้วยเสมอ**: แก้ทั้ง `GUIDE_SECTIONS` ใน `About.jsx` และ [USER_GUIDE.md](USER_GUIDE.md) ให้ตรงกัน — สองที่นี้ต้องเป็นเนื้อหาเดียวกัน (คู่มือในแอป vs. ไฟล์นอกแอปไว้อ่าน/รีวิว) ห้ามแก้แค่ที่เดียว
