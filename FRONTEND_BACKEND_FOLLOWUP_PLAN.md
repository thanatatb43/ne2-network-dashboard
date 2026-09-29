# แผนงาน frontend หลัง backend อัปเดต — 28 กันยายน 2026

สถานะ: ดำเนินการแล้ว 29 กันยายน 2026 — ดูผลและข้อจำกัดใน[หัวข้อ 12](#12-ผลดำเนินการ-29-กันยายน-2026)

## 1. ขอบเขตและหลักฐาน

- อ้างอิง `REMAINING_UX_UI_BACKEND_RESPONSE.md` ฉบับที่มีหัวข้อ “เพิ่มเติม 28 กันยายน 2026 — 5 รายการสำหรับ frontend” จากไฟล์ที่ผู้ใช้แนบ
- อ้างอิง [มาตรฐานการออกแบบ](DESIGN_STANDARDS.md), [แผนหน้าที่เหลือ](REMAINING_UX_UI_IMPROVEMENT_PLAN.md) และ [สเปก API เดิม](REMAINING_UX_UI_BACKEND_API_SPEC.md)
- ตรวจ source ล่าสุด: งานยังเรียงใน browser, ประวัติทดสอบยังโหลด endpoint โดยไม่ส่ง pagination, ล้างพิกัดยังไม่ส่ง field, ข้อความเตือน upload ยังบอกว่าการผูกงานอาจได้รับผลกระทบ และ auth interceptor ยังรวมทุก 401 เป็น logout
- backend แจ้งว่ารองรับทั้ง 5 เรื่องแล้ว ข้อสรุปนี้มาจากเอกสาร ไม่ใช่การทดสอบ API จริงซ้ำในรอบเขียนแผน
- คง feature เดิม การจำตัวกรอง/หน้ารายการ การกลับจากรายละเอียด การใช้งาน desktop/mobile และสิทธิ์เดิม
- ไม่รวมการสร้าง endpoint ใหม่หรือเปลี่ยนนโยบายสิทธิ์โดยอัตโนมัติ

## 2. ลำดับดำเนินการ

| ลำดับ | งาน | ผลลัพธ์ |
|---|---|---|
| 1 | แก้ navigation guard ที่ยังมีช่องว่าง | ย้อนข้ามหลายหน้าแล้วฟอร์มไม่หายก่อนยืนยัน |
| 2 | เชื่อม auth error codes/session | แจ้งสาเหตุถูกต้อง ไม่ให้ response ของ token เก่าทำ session ใหม่หลุด |
| 3 | ปรับ upload งบและการเลือกธุรกรรม | อธิบายสำเนางานถูกต้อง และไม่ใช้ source IDs เก่าหลังแทนที่ |
| 4 | เรียงงานผ่าน server | เรียงทั้งผลกรองก่อนแบ่งหน้า |
| 5 | ประวัติทดสอบแบบ server pagination | เปิดประวัติเกิน 100 รายการและเลือกช่วงเวลาได้ |
| 6 | ล้างพิกัดสำนักงาน | บันทึก JSON null เมื่อผู้ใช้ตั้งใจล้าง |
| 7 | ตรวจ responsive/accessibility และ regression | desktop/mobile/dark/200% และขั้นตอนหลักผ่าน |

แยก commit ตามงาน พร้อมบันทึกสิ่งที่ทดสอบและข้อจำกัด ไม่รวมไฟล์ค้างของงานอื่นโดยไม่ตรวจ diff

## 3. Navigation guard และฟอร์ม

ไฟล์หลัก: `src/App.jsx`, `src/navigationGuard.js`, `src/components/NetworkDeviceManagement.jsx`, `src/components/JobWorkflowModals.jsx`

### ปัญหาที่ต้องแก้

ฟอร์มเครือข่ายตั้ง `handlesPopstate: true` แต่ App ยังเรียก applyRoute หลังข้าม guard เมื่อ Back ข้ามไปคนละ route ฟอร์มอาจ unmount ก่อนการเลื่อน history กลับและก่อนตอบยืนยัน

### แนวทาง

- ให้มีผู้ประสานงาน popstate จุดเดียว แยกผล “อนุญาต”, “กำลังคืนตำแหน่ง”, “รอยืนยัน” ออกจากการตรวจ dirty
- ขณะคืนตำแหน่ง/รอยืนยัน ห้าม App เปลี่ยน route หรือถอดฟอร์ม
- เก็บปลายทางและระยะการเคลื่อนจริง รองรับ Back, Forward และ history.go หลายขั้น
- “อยู่ต่อ” ต้องคง draft, URL, history.state และจำนวน entries; “ออก” ต้องไปปลายทางที่ผู้ใช้เลือกจริง ไม่ย้อนไปหนึ่งขั้นเสมอ
- กรณี entries เก่าไม่มี index ต้องมีทางออกที่ยังถามก่อนทิ้งข้อมูล ระบุข้อจำกัดเรื่องการรักษา Forward ให้ชัด ไม่ปิดฟอร์มเงียบ ๆ
- ป้องกันการกด navigation ซ้ำระหว่างคืน history และไม่ใช้ pending action เก่าหลัง logout
- คงการถาม reload/ปิดแท็บด้วย beforeunload; browser อาจแสดงข้อความมาตรฐานของตัวเอง
- ขณะบันทึกใช้ข้อความว่าผลลัพธ์อาจยังไม่ทราบ การออกจากหน้าไม่ได้แปลว่า request ถูกยกเลิกหรือข้อมูลไม่ถูกเขียน

### ตรวจรับ

ทดสอบฟอร์มอุปกรณ์คอมพิวเตอร์/เครือข่าย/ผู้ใช้ และ modal งาน/งบ/อัปโหลด/สำนักงาน: dirty, clean, busy, save fail, Back/Forward หนึ่งและหลายขั้น, reload และเมนูด้านข้าง โดยใช้ mock สำหรับการเขียน

## 4. Auth/session

ไฟล์หลัก: `src/App.jsx`, `src/components/Auth.jsx`, `src/components/SsoCallback.jsx` และตัวช่วย auth ที่แยกออกมาเพื่อทดสอบ

### Contract ที่ต้องใช้

- JWT อายุ 24 ชั่วโมง ไม่ใช่ sliding session ไม่มี refresh token
- หลาย login พร้อมกันได้ ไม่มี SESSION_REPLACED; token ใหม่มี jti แต่ token เก่าที่ไม่มี jti ยังใช้ได้
- login และ verify มี session metadata; SSO fragment ยังมี token/user ให้ใช้ verify อ่าน metadata
- 403 = ไม่มีสิทธิ์; 503 = ตรวจ auth ไม่ได้ ไม่ใช่ session หมดอายุ

### งาน frontend

| กรณี | การจัดการ |
|---|---|
| AUTH_INVALID_CREDENTIALS | แสดง error ในหน้า login และล้างรหัสผ่าน ไม่ logout session อื่นจาก request นี้ |
| AUTH_TOKEN_EXPIRED / INVALID / REVOKED / AUTH_USER_NOT_FOUND | แจ้งภาษาไทยตามสาเหตุ เคลียร์ session ที่ได้รับผล และให้เข้าสู่ระบบใหม่ |
| AUTH_TOKEN_MISSING | ตรวจว่าคำขอนั้นควรส่ง token หรือไม่ อย่าเหมาว่า token ปัจจุบันหมดอายุ |
| AUTH_TOKEN_NOT_ACTIVE | แจ้งว่ายังใช้ token ไม่ได้/ตรวจเวลา ไม่วน retry อัตโนมัติ |
| AUTH_FORBIDDEN (403) | คง session แสดงข้อจำกัดสิทธิ์ |
| AUTH_SERVICE_UNAVAILABLE (503), network error | คง session แจ้งตรวจสอบไม่ได้และให้ลองใหม่ |

- อ่าน body ผ่าน response.clone() เพื่อไม่กิน response ที่ component ต้องใช้
- จำกัด interceptor ให้ API ของระบบ ตรวจ Authorization ทั้ง Request และ Headers/object อย่างถูกต้อง
- เทียบ token ของ request กับ token ปัจจุบันก่อนเคลียร์ session: response 401 ของ token A ที่กลับมาหลัง login ได้ token B ต้องไม่ logout B
- แยกการล้าง session เพราะหมดอายุออกจาก logout ที่ผู้ใช้สั่ง ไม่เรียก revoke token ปัจจุบันเพราะ response เก่าหรือ endpoint login ล้มเหลว
- คง logout ที่ผู้ใช้สั่งและ flow SSO logout เดิม; แยก frontend inactivity 30 นาทีออกจาก JWT TTL 24 ชั่วโมง อธิบายให้ชัดและไม่เปลี่ยนระยะเวลาเอง
- ใช้ metadata เพื่อสื่อสารเวลา ไม่ถอด payload JWT มาเป็นหลักฐานสิทธิ์แทน backend
- ล้างรหัสผ่านและปิด show-password เมื่อ login ล้มเหลว รวม catch; เก็บ username เพื่อให้ลองใหม่ได้
- ไม่บันทึก token/password ลง log, fixture หรือรายงาน

### ข้อจำกัดที่ต้องเปิดเผย

เปลี่ยน password/role ยังไม่ revoke JWT เดิม role ใน token อาจค้างจนหมดอายุ การตรวจสิทธิ์จาก UI ไม่แก้ข้อจำกัด backend นี้ หากต้องการสิทธิ์ใหม่มีผลทันทีให้แยกงาน backend ต่างหาก ไม่ใช่สิ่งที่แผนนี้รับรอง

## 5. Upload งบประมาณและสำเนาธุรกรรมงาน

ไฟล์หลัก: `src/components/BudgetManagement.jsx`, `src/components/BudgetTransactionPicker.jsx`, หน้ารายละเอียดงานและ resource/cache งบที่เกี่ยวข้อง

- เปลี่ยนข้อความยืนยันเป็น “แทนที่ข้อมูลต้นทางเฉพาะบัญชีและปีที่เลือก โดยข้อมูลธุรกรรมที่แนบสำนักงาน/งานไว้แล้วจะคงเดิม”
- อธิบายว่า `SiteBudgetTransactions` เป็นสำเนาตอนแนบงาน ไม่อัปเดตตามไฟล์ใหม่ ไม่ใช่ join กลับด้วย source ID
- คงขั้นยืนยันบัญชี/ปี/ชื่อไฟล์ ไม่เปลี่ยน endpoint upload หรือสิทธิ์
- หลัง upload สำเร็จ invalidate รายการและตัวเลือก source transactions; เคลียร์ selection ที่อ้าง source IDs เก่าในขอบเขตที่ถูกแทนที่ แล้วให้ผู้ใช้เลือกใหม่ก่อนแนบงาน
- ไม่ลบ/แก้สำเนาธุรกรรมงาน และไม่จับคู่ source ใหม่ด้วย RefDocNo ซึ่งอาจซ้ำ
- ถ้ารู้ว่าชุดข้อมูลเปลี่ยนระหว่างเปิด picker ให้แจ้งและโหลดใหม่ ไม่ถือว่า ID ที่หายไปคือธุรกรรมเดียวกันในไฟล์ใหม่
- แยกผล “นำเข้าต้นทางสำเร็จ แต่สร้าง budget snapshot ไม่สำเร็จ” เมื่อ `budget_snapshot=null`; ห้ามแสดงว่าสำเร็จครบหรือชวน upload ซ้ำทันที
- กรณี timeout/network disconnect ให้บอกว่าไม่ทราบผลและตรวจข้อมูลก่อนลองซ้ำ ไม่รับรอง rollback หากไม่ได้รับคำตอบ
- การแจ้ง refresh ภายในแอปไม่ใช่หลักประกันป้องกัน concurrent upload จากทุก client; รับมือ stale ID/error โดยเก็บ draft และให้เลือกใหม่

ตรวจรับด้วย mock/fixture: source 50 → 99 แต่สำเนางานยัง 50, source ID เปลี่ยน, insert rollback, snapshot fail หลัง source commit, stale selection และ request ไม่ได้รับคำตอบ

## 6. เรียงงานผ่าน backend

ไฟล์หลัก: `src/components/JobManagement.jsx`

- ส่ง sort/order พร้อม page/limit และ filters เดิมไป `GET /api/pea-jobs`
- ใช้ whitelist: createdAt, pea_name, job_name, job_type, status, priority, updatedAt, id
- ค่าเริ่มต้น createdAt DESC; ใช้ลำดับรองจาก backend ไม่จัดซ้ำจนลำดับเปลี่ยน
- ตรวจ `meta.sort_scope=all_filtered_records` ก่อนเอาข้อความ “เฉพาะในหน้านี้” ออก
- เปลี่ยน sort/filter/page size ให้เริ่มหน้า 1; จำ state และคืนเมื่อกลับจากรายละเอียด
- แสดง aria-sort ให้ตรง request ที่ใช้จริง ป้องกัน response เก่าทับผลใหม่
- หน้าเกินขอบ: ใช้ total จริงแล้วพากลับหน้าที่มีข้อมูลอย่างมีขอบเขต ไม่วน fetch
- 400 INVALID_SORT ต้องแสดง error/แก้ persisted sort ที่ไม่รองรับ ไม่แสดง empty success

### ช่องว่าง contract ที่เพิ่งพบจาก source

หน้าปัจจุบันมีการเรียง `transactions` (ยอดธุรกรรม) แต่ whitelist ใหม่ไม่มี field นี้ จึงห้ามส่งตรง ๆ และห้ามอ้างว่าเรียงทั้งชุดได้

รอบแรกคงฟังก์ชันนี้เป็น “เรียงยอดเฉพาะหน้านี้” อย่างชัดเจน ส่วนคอลัมน์ที่รองรับใช้ server หากต้องการเรียงยอดทั้งชุด ให้ขอ backend ขยาย endpoint เดิมพร้อมนิยามว่าเป็นยอดสุทธิจากสำเนาธุรกรรมใด ไม่ลด feature เงียบ ๆ

## 7. ประวัติทดสอบเครือข่าย

ไฟล์หลัก: `src/components/NetworkTestHistory.jsx`, `src/components/NetworkTestHistory.css`

- ใช้ `GET /api/test/history?page=&page_size=&date_from=&date_to_exclusive=`
- อ่าน pagination.total_items/total_pages จาก server ไม่คำนวณจาก rows หน้านี้
- ตรวจ meta.pagination_version=v1 ก่อนเอาคำเตือน “100 รายการล่าสุด” ออก
- เพิ่มช่วงวันที่ โดยวันสิ้นสุดที่ผู้ใช้เลือกนับรวมทั้งวัน: ส่งเที่ยงคืนวันถัดไปเป็น date_to_exclusive ตาม Asia/Bangkok พร้อม timezone ใช้ URLSearchParams เพื่อ encode +07:00
- ตรวจ from < to, วันที่จริง, ค่าว่าง, วันที่ข้ามเดือน/ปี/ปีอธิกสุรทิน
- ไม่ส่ง query ที่ API ไม่รองรับ เพราะ backend ปฏิเสธ unknown/duplicate query
- แบ่ง loading/empty/error/stale ชัดเจน ยอดรวมยังหมายถึงผลกรองของ server
- คง sessionStorage ของช่วงเวลา/page/page size และ validate ค่าเก่าก่อนใช้
- รองรับ total_pages=0 และหน้าที่เกินขอบ ห้ามแสดง “หน้า 1 จาก 0”

### การค้นหาและเรียงเดิมต้องไม่หาย

API ใหม่รองรับช่วงเวลา แต่ยังไม่รับ search หรือ sort ความเร็ว/latency และเรียง timestamp DESC คงที่

- รอบแรกคงค้นหาและเรียงในหน้าที่โหลด พร้อมป้ายชัดว่า “เฉพาะหน้านี้”; แยกจำนวนที่พบในหน้าออกจาก total ของช่วงเวลา
- ไม่ดาวน์โหลดทุกหน้าเงียบ ๆ เพื่อจำลอง global search
- ถ้าต้องการค้นชื่อเครื่อง/IP/ผู้ทดสอบ หรือเรียง download/upload/latency ทั้งประวัติ ต้องขอ backend ขยาย endpoint เดิมก่อนรับรอง feature นั้น ไม่ใช่สร้าง endpoint ใหม่

## 8. ล้างพิกัดสำนักงาน

ไฟล์หลัก: `src/components/settings/SettingsLocations.jsx`

| การแก้ไข | Payload |
|---|---|
| ไม่แก้พิกัด | ไม่ส่ง coordinates |
| ล้างค่าที่เคยมี | coordinates: null แบบ JSON |
| ระบุใหม่ | coordinates: "latitude, longitude" |
| สร้างสำนักงานโดยไม่ระบุพิกัด | omit หรือ null ตาม contract |

- เทียบกับ baseline เพื่อแยกไม่แก้กับตั้งใจล้าง ไม่ใช้ truthiness ตัดค่า 0
- ตรวจ latitude -90 ถึง 90 และ longitude -180 ถึง 180; 0,0 เป็นค่าถูกต้อง
- ไม่ส่ง empty string หรือสตริง "null"
- เปลี่ยนข้อความช่วยจาก “ล้างไม่ได้” เป็น “ล้างช่องเพื่อนำพิกัดออก”
- บันทึกล้มเหลวเก็บ draft; สำเร็จ reload แล้วยืนยันว่าไม่มี marker/link ไปพิกัดเดิม
- คง super_admin และ dirty guard เดิม

## 9. มาตรฐาน UX/UI และ regression

- ตรวจ desktop 1280/1440, tablet 768, mobile 360/390 และซูม browser 200% จริง
- ทดสอบ light/dark, keyboard Tab/Enter/Escape, focus กลับตำแหน่งเดิม, label/error association และ modal ซ้อน
- ตาราง desktop ข้อความบรรทัดเดียวพร้อม …/ชื่อเต็มเมื่อ hover; ตัวเลขชิดขวาทั้งหัวและข้อมูล ปุ่ม 44px และไม่ตกบรรทัดจนแถวผิดสัดส่วน
- หน้าจอแคบใช้รูปแบบตาม DESIGN_STANDARDS ไม่ทำให้ทั้งหน้าเลื่อนแนวนอนเพราะตาราง
- ตรวจช่องที่กรอกแล้วมี highlight ตามมาตรฐาน รวมตัวกรองใหม่
- ตรวจงานค้างเดิม StockManagement.css และ validation สถานะใน equipment-form ก่อนรวม commit แยกจากงานนี้
- อัปเดต USER_GUIDE/About/แผนหลักให้ตรงกับพฤติกรรมที่ทำจริง โดยเฉพาะ scope การค้น/เรียง, สำเนางบ และ session

## 10. หลักฐานก่อนปิดงาน

1. เพิ่ม regression tests ที่ทดสอบ navigation/history จริงหรือ browser mock รวม multi-step Back/Forward ไม่ใช้แค่ unit tests เดิม 20 รายการเป็นหลักฐานว่าครอบคลุมงานใหม่
2. Auth mock: ทุก error code, token A ตอบช้าหลังได้ B, 403/503 ไม่ logout, login network fail ล้าง password
3. Mock การบันทึก/ลบ/อัปโหลดและตรวจ request body โดยไม่เขียนข้อมูลจริง
4. อ่าน API จริงเพื่อยืนยัน capability metadata/shape เมื่อมี session ที่อนุญาตอยู่แล้ว ไม่ login บัญชี shared ซ้ำโดยไม่จำเป็น และไม่รัน probe ที่มีผลเขียนข้อมูลเพียงเพราะเป็น GET
5. ทดสอบ SSO redirect จริงเป็นรอบแยกเมื่อมีบัญชี/สภาพแวดล้อมพร้อม ไม่อ้าง URL จำลองว่าเท่ากับทดสอบ provider จริง
6. Build ผ่าน, lint ไฟล์ที่แก้ไม่มีปัญหาใหม่ และรายงาน baseline ทั้งโปรเจกต์แยก errors/warnings
7. รายงานผล desktop/mobile/dark/200% พร้อมสิ่งที่ยังไม่ได้ทดสอบและข้อจำกัด concurrent requests

## 11. สิ่งที่ไม่ต้องรอ backend และคำถามทางเลือก

งานหลักทั้ง 5 เรื่องเริ่มเชื่อมได้ตาม contract ล่าสุด ไม่ต้องสร้าง API ใหม่ การแก้ guard และ login เป็น frontend ล้วน

คำถามเพิ่มเติมมีเฉพาะกรณีต้องการขยายขอบเขต feature: เรียงยอดธุรกรรมของงานทั้งชุด และค้นหา/เรียงค่าความเร็วทั้งประวัติทดสอบ ซึ่ง endpoint ล่าสุดยังไม่รองรับ ให้ยืนยันขอบเขตก่อนพัฒนา backend เพิ่ม

การให้ password/role ใหม่มีผลกับ JWT เดิมทันทีเป็นงานนโยบาย auth แยก ส่วนข้อจำกัด N1 ที่บันทึกไว้ในเอกสาร backend ยังเป็น backlog เดิม ไม่ถือว่าเสร็จจากแผนนี้

## 12. ผลดำเนินการ 29 กันยายน 2026

| งาน | commit | ทดสอบ |
|---|---|---|
| Navigation guard: ผู้ประสานงาน popstate จุดเดียว (capture) คืนตำแหน่งตามระยะจริง รองรับ Back/Forward หลายขั้น | `1da2b95` | unit `navigationGuard.test.mjs` + browser mock 17 กรณี (ฟอร์มคอมพิวเตอร์/เครือข่าย/ผู้ใช้, modal งาน/งบ/สำนักงาน) |
| Auth/session: รหัส error, เทียบ token ของ request, ไม่ revoke จาก response เก่า, metadata หมดอายุ, idle ข้ามแท็บ | `a7155bd` | unit `authSession.test.mjs` + browser mock 18 กรณี |
| Upload งบ: ข้อความสำเนางาน, snapshot ล้มเหลว, เคลียร์ selection ที่อ้าง source ID เดิม (รวมข้ามแท็บ) | `293ea5b` | unit `budgetEvents.test.mjs` + browser mock |
| เรียงงานผ่าน server (ยกเว้นธุรกรรม = เฉพาะหน้า), INVALID_SORT ไม่วนซ้ำ | `60232a0` | browser mock 14 กรณี + GET จริงยืนยัน `meta.sort_scope` |
| ประวัติทดสอบแบบ server pagination + ช่วงวันที่ (เวลาไทย) | `cd83a82` | unit `historyDates.test.mjs` + browser mock 14 กรณี |
| ล้างพิกัดด้วย JSON null | `f78a739` | unit `settingsShared.test.mjs` + browser mock ตรวจ body |

ข้อจำกัดที่ยังอยู่:

- entries ประวัติที่สร้างก่อนอัปเดตไม่มีตำแหน่ง ระบบยังถามก่อนทิ้งข้อมูล แต่รักษา Forward ไม่ได้ในกรณีนั้น
- beforeunload (รีโหลด/ปิดแท็บ) ใช้ข้อความมาตรฐานของเบราว์เซอร์; ทดสอบใน headless ไม่ได้
- การแจ้งเปลี่ยนชุดธุรกรรมเป็นความช่วยเหลือภายในเบราว์เซอร์เดียวกัน ไม่กัน upload พร้อมกันจาก client อื่น
- ค้นหา/เรียงความเร็วของประวัติทดสอบ และเรียงจำนวนธุรกรรมของงาน ยังทำได้เฉพาะหน้าที่โหลด (ต้องขยาย endpoint เดิมถ้าต้องการทั้งชุด)
- เปลี่ยน role/password ยังไม่ revoke JWT เดิม (ข้อจำกัด backend)
- ยังไม่ได้ทดสอบ SSO redirect จริง และไม่ได้อ่าน API จริงส่วนที่ต้องมี session (history/verify) เพราะไม่มี session ที่ใช้ได้ และแผนให้เลี่ยงการ login บัญชีร่วมซ้ำ
- dark mode ตรวจโดยใส่ class `.dark-theme` เอง เพราะแอปยังไม่มีปุ่มสลับธีม

