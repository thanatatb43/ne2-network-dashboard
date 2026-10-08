# ข้อเสนอปรับปรุง API สำหรับ Office Equipment Dashboard จากฝั่ง UI

วันที่: 6 ตุลาคม 2569

อ้างอิง: `OFFICE_EQUIPMENT_DASHBOARD_BACKEND.md` ฉบับวันที่ 6 ตุลาคม 2569

สถานะ: ข้อเสนอเพื่อให้ทีม backend ยืนยันก่อนเชื่อมต่อ UI ไม่ใช่ข้อยืนยันว่า API พร้อมใช้งานแล้ว และไม่แทนที่ข้อกำหนดเดิมทั้งหมด

## 1. เป้าหมายการเชื่อมต่อ

ฝั่ง UI ต้องการเพิ่มภาพรวมคอมพิวเตอร์ในหน้าหลัก และให้ผู้ใช้เปิดดูกราฟ ตารางรายละเอียด ตัวกรอง และ export ได้ โดยใช้ API ใหม่ภายใต้ `/api/office-equipment/dashboard`

หน้าหลัก `/` ปัจจุบันเป็นแผนที่สำนักงานและสถานะเครือข่าย ข้อเสนอ UI คือเพิ่มส่วนสรุปอุปกรณ์พร้อมทางเข้าหน้ารายละเอียด dashboard ส่วนการนำจำนวนอุปกรณ์ไปแสดงบนหมุดแผนที่เป็นขอบเขตเพิ่มเติมที่ต้องตกลงแยกต่างหาก

สเปกเดิมครอบคลุมงานทะเบียนอุปกรณ์ Phase 1 ได้เป็นส่วนใหญ่ ขอปรับหรือยืนยันประเด็นต่อไปนี้เพื่อให้ KPI กราฟ ตาราง และ export ใช้ข้อมูลและนิยามเดียวกัน

## 2. ประเด็นที่ต้องยืนยันก่อนเชื่อม UI

### 2.1 นิยามจำนวนคอมพิวเตอร์และการกรองหลายประเภท

ขอแยกคำว่า “จำนวนคอมพิวเตอร์” ออกจาก “จำนวนทะเบียนอุปกรณ์” ให้ชัดเจน:

- จำนวนคอมพิวเตอร์: เสนอให้นับ PC + Notebook โดยขอ backend ยืนยันชื่อประเภทจริงและประเภทอื่นที่ควรรวม
- จำนวนจอภาพ: Monitor แยกต่างหาก
- จำนวนอุปกรณ์ทั้งหมด: ทุกทะเบียนที่ผ่าน filters ตามนิยามเดิม
- PC และ Monitor ยังคงเป็นคนละทะเบียน ไม่จับคู่หรือลดจำนวนให้เป็นเครื่องเดียว

ตัวเลขในเอกสารอ้างอิง PC 168 + Notebook 216 = 384 เครื่อง และเมื่อรวม Monitor 168 เป็น 552 รายการ ใช้เพื่ออธิบายนิยามเท่านั้น ห้าม hardcode เป็นยอดใน UI หรือ API

ปัจจุบัน `equipment_type` รับค่าเดียว ทำให้ไม่สามารถเลือก PC + Notebook พร้อมกันใน request เดียวได้ครบทุกส่วน ขอพิจารณาเพิ่ม **ตัวกรองกลุ่มประเภท** ใน API ใหม่ โดยเสนอรูปแบบ:

```text
equipment_group=computer
```

ข้อกำหนดที่เสนอ:

1. Backend เป็นผู้กำหนด mapping ของ `computer` กับค่าประเภทจริงในฐานข้อมูล และระบุไว้ใน API contract
2. ไม่ส่ง `equipment_group` หมายถึงไม่กรองกลุ่มประเภท และคงพฤติกรรมเดิม
3. ใช้กับทุก endpoint Phase 1 รวม selectors, summary, distribution, quality, equipment, contracts และ export
4. เมื่อส่งทั้ง `equipment_group` และ `equipment_type` ให้ใช้แบบ AND เพื่อเลือกประเภทย่อยภายในกลุ่ม; ค่าที่ถูกต้องแต่ไม่อยู่ในกลุ่มให้ผลลัพธ์ว่างตามกติกาเดิม
5. ค่า group ที่ไม่รองรับตอบ 400 `INVALID_QUERY` พร้อม `error.field=equipment_group`
6. ส่งค่าที่ใช้จริงกลับใน `meta.filters` และบันทึกใน sheet Filters ของ export
7. `/selectors` ต้องคงขอบเขต `equipment_group` ขณะคำนวณตัวเลือกประเภท แม้จะยกเว้น `equipment_type` ของ dimension นั้นตามกติกาเดิม

หาก backend เลือกรองรับหลายค่าแทน เช่น repeated query parameters ขอระบุรูปแบบ serialization, กติกา OR ภายในประเภท, AND กับ filters อื่น และพฤติกรรม selectors ให้ชัดเจน ไม่จำเป็นต้องพัฒนาทั้งสองแนวทาง

UI ไม่ควรดึงรายการเพียงบางหน้าแล้วนับ PC + Notebook เอง เพราะยอด กราฟ pagination และ export จะไม่สอดคล้องกัน

### 2.2 สิทธิ์การดูข้อมูลบนหน้าหลัก

ยึดข้อกำหนดเดิมที่ API dashboard ทุกเส้นต้องใช้ Bearer token รวม export โดยเสนอให้ UI เรียกข้อมูลส่วนนี้หลังเข้าสู่ระบบ และแสดงทางเข้าสู่ระบบเมื่อยังไม่มี session

ขอ backend ยืนยัน:

- ผู้ใช้ที่เข้าสู่ระบบทุก role อ่าน dashboard ได้หรือมีข้อจำกัดเพิ่มเติม
- ขอบเขตสำนักงานของผู้ใช้แต่ละกลุ่ม และใช้ขอบเขตเดียวกันทั้ง selectors, summary, drill-down และ export
- เมื่อผู้ใช้เปิดรายละเอียดผ่าน `GET /api/office-equipment/:id` เดิม สิทธิ์และข้อมูลที่ได้สอดคล้องกับนโยบายที่ตกลงสำหรับ dashboard หรือไม่; หากต่างกัน ขอระบุไว้ให้ UI ทราบ
- รหัส error 401/403 ใช้ระบบ auth ชุดเดียวกับ API เดิม

UI ปัจจุบันรองรับรหัส เช่น `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_REVOKED`, `AUTH_TOKEN_MISSING` และ `AUTH_FORBIDDEN` ขอใช้รหัสเดิมตามความหมายของระบบ และส่งใน `error.code` ตาม envelope ที่เสนอ

หากภายหลังต้องการให้ผู้ไม่เข้าสู่ระบบเห็นยอดรวม ต้องตกลงขอบเขตข้อมูลและ API สำหรับกรณีนั้นเพิ่มเติม ไม่ถือว่าเป็นข้อกำหนดให้เปิด dashboard ปัจจุบันเป็น public

### 2.3 ตัวอย่าง response และ contract ที่พร้อมใช้

ขอ JSON ตัวอย่างครบทุก endpoint Phase 1 หรือ OpenAPI พร้อม examples โดยมีข้อมูลต่อไปนี้:

| Endpoint | ตัวอย่างที่ UI ต้องใช้ |
|---|---|
| `/selectors` | ค่าจริงของประเภท/สถานะ, option null, ตัวอย่างเมื่อกรองสำนักงานหรือกลุ่มประเภท |
| `/summary` | ทุก field รวม by_type, by_status และ contract_expiry |
| `/distribution` | ข้อมูลกลุ่มปกติและกลุ่มไม่ระบุ, drilldown, pagination, meta.equipment_total |
| `/quality` | issue ทุก code รวม count=0 และ equipment_with_issues |
| `/equipment` | รายการเต็มตาม schema, quality_issues, null และ pagination |
| `/contracts` | วันสัญญาหลายค่า, date_inconsistent, กลุ่มไม่มีเลขสัญญา และ drilldown |
| `/export` | ไฟล์ตัวอย่าง, response headers และ JSON error เมื่อ export เกินข้อจำกัด |

ขอระบุชนิดข้อมูลและ nullable ของทุก field รวมถึงรูปแบบสมาชิกใน `quality_issues`, `drilldown` และ `meta.filters` ให้ชัดเจน โดย counts เป็น number และวันที่ยึด DATEONLY/ISO timestamp ตามสเปกเดิม

ขอตัวอย่างกรณีไม่มีข้อมูล, query ไม่ถูกต้อง, ไม่มี token, ไม่มีสิทธิ์ และระบบผิดพลาด เพื่อให้ UI แยกสถานะว่างออกจากสถานะโหลดไม่สำเร็จได้

### 2.4 ขอบเขตรายละเอียดคอมพิวเตอร์

Phase 1 ตามสเปกปัจจุบันเป็น dashboard ทะเบียนอุปกรณ์ ไม่ใช่ข้อมูล monitoring รายเครื่อง ขอ backend ยืนยันว่าข้อมูลที่จะส่งครอบคลุมทะเบียน ผู้ครอบครอง สำนักงาน แผนก สถานะทะเบียน และสัญญาตาม schema เดิม

หากต้องการแสดงข้อมูลต่อไปนี้ ขอแยกเป็นงานเพิ่มเติมพร้อมแหล่งข้อมูล ชนิดข้อมูล ค่า null และความถี่การอัปเดต:

- CPU, RAM, Storage, OS และรุ่นอุปกรณ์ที่แยกเป็นฟิลด์
- Computer name, IP address, online/offline และ last seen
- วันเริ่ม/สิ้นสุดรับประกัน และวันรับสินค้า

ห้ามตีความสถานะทะเบียน “ใช้งาน” ว่าเครื่องออนไลน์ และไม่ใช้วันหมดสัญญาแทนวันหมดประกัน รายละเอียดรุ่น/ประกันใน `notes` แสดงเป็นข้อความได้ แต่ยังไม่ควรใช้คำนวณ KPI หรือกรองวันที่โดยไม่มี contract เพิ่มเติม

## 3. การเพิ่มในหน้าหลักและผลกระทบ API เดิม

| ส่วน | แนวทางที่เสนอ |
|---|---|
| API แผนที่/เครือข่ายเดิม | ไม่ต้องเปลี่ยน response เพื่อเพิ่มส่วนสรุปอุปกรณ์ในหน้าเดียวกัน |
| API รายการและค้นหาอุปกรณ์เดิม | คงพฤติกรรมเดิม; dashboard ใช้ `/dashboard/equipment` สำหรับรายการที่ตรงกับยอดสรุป |
| API รายละเอียด `GET /api/office-equipment/:id` | ใช้เดิมเมื่อเปิดหน้ารายละเอียดรายเครื่อง |
| API เพิ่ม/แก้ไข/ลบทะเบียน | ไม่ต้องเปลี่ยนเพื่อรองรับ dashboard แบบอ่านอย่างเดียว |
| Router ฝั่ง backend | mount `/dashboard` ก่อน `/:id` และตรวจ regression ของเส้นเดิม |

ไม่จำเป็นต้องรวมข้อมูลอุปกรณ์ใหม่ลงใน API เครือข่ายหรือเปลี่ยน response เดิม UI จะโหลดข้อมูลแต่ละส่วนแยกกัน เพื่อให้ความผิดพลาดของส่วนหนึ่งไม่ทำให้หน้าหลักทั้งหมดใช้งานไม่ได้

ไม่จำเป็นต้องเพิ่ม endpoint รวมทุก widget ใน Phase 1 หากแต่ละเส้นทำงานได้ตามเป้าหมายประสิทธิภาพในเอกสารเดิม

## 4. ข้อเสนอเฉพาะกรณีแสดงจำนวนบนหมุดแผนที่

ส่วนนี้เป็นทางเลือก ไม่ใช่เงื่อนไขสำหรับเริ่ม dashboard แบบการ์ด/กราฟ/ตาราง

แผนที่ UI ปัจจุบันคัดเฉพาะสำนักงานที่มีอุปกรณ์เครือข่ายสำหรับ monitoring จึงไม่สามารถถือว่ารายการสำนักงานบนแผนที่ครอบคลุมสำนักงานที่มีคอมพิวเตอร์ทั้งหมด

หากต้องการแสดงจำนวนอุปกรณ์บนแผนที่ ขอ backend ยืนยัน:

1. `distribution.key` เมื่อ `group_by=site` เป็น ID เดียวกับ `pea_site_id` และ ID ของสำนักงานใน API ตำแหน่ง
2. API ตำแหน่งให้ข้อมูลสำนักงานที่ต้องใช้ครบ รวมสำนักงานที่ไม่มี monitored network device; หาก API เดิมให้ครบอยู่แล้วไม่ต้องเพิ่มเส้นใหม่
3. วิธีดึง distribution ครบทุกกลุ่ม เนื่องจาก endpoint มี pagination; UI อาจเรียกครบทุกหน้า หรือร่วมกันออกแบบ endpoint สำหรับแผนที่หากจำนวนข้อมูลมาก
4. อุปกรณ์ที่ไม่มีสำนักงานหรือสำนักงานไม่มีพิกัดต้องยังอยู่ในยอดรวม และ UI แสดงจำนวนที่วางบนแผนที่ไม่ได้แยกต่างหาก

ใช้คำว่า “สำนักงานในระบบ” เพราะข้อมูลนำเข้าบางชุดยังไม่ยืนยันตำแหน่งติดตั้งจริง และไม่ส่งตัวกรองเครือข่าย เช่น online/offline ไปยัง dashboard อุปกรณ์โดยไม่มีนิยามรองรับ

## 5. Export และการเชื่อมต่อผ่าน browser

ยึดรูปแบบ `.xlsx`, filters, sort และข้อจำกัด 20,000 แถวตามเอกสารเดิม ขอเพิ่มรายละเอียดการเชื่อมต่อดังนี้:

- UI เรียก export ด้วย Bearer token แล้วดาวน์โหลด response แบบ binary
- หาก frontend/backend อยู่คนละ origin ขอให้ CORS รองรับ origin และ Authorization ที่ใช้งานจริง
- หากให้ UI อ่านชื่อไฟล์จาก `Content-Disposition` ขอ expose header นี้ผ่าน CORS
- ขอรูปแบบชื่อไฟล์ที่แน่นอน; ถ้ามีภาษาไทยให้กำหนด encoding ของชื่อไฟล์ใน header ให้ชัดเจน
- เมื่อ export ไม่สำเร็จ ขอคืน JSON error ตาม envelope เดิมพร้อม Content-Type ที่ตรงกับ response รวม 422 `EXPORT_TOO_LARGE`

## 6. แนวทางเรียก API จาก UI

ตัวอย่างต่อไปนี้ใช้ `equipment_group=computer` ซึ่งเป็นข้อเสนอที่ยังต้องให้ backend ยืนยัน:

```text
# ส่วนสรุปบนหน้าหลักหลังเข้าสู่ระบบ
GET /api/office-equipment/dashboard/summary?equipment_group=computer

# หน้า dashboard รายละเอียด
GET /api/office-equipment/dashboard/selectors?equipment_group=computer
GET /api/office-equipment/dashboard/distribution?equipment_group=computer&group_by=site&page=1&limit=20
GET /api/office-equipment/dashboard/quality?equipment_group=computer
GET /api/office-equipment/dashboard/equipment?equipment_group=computer&page=1&limit=20
GET /api/office-equipment/dashboard/contracts?equipment_group=computer&expiry_bucket=within_180_days

# รายละเอียดรายเครื่อง ใช้ API เดิม
GET /api/office-equipment/19376

# Export ใช้ filters/sort ของตาราง แต่ไม่ส่ง page/limit
GET /api/office-equipment/dashboard/export?equipment_group=computer
```

UI จะใช้ filters ฐานชุดเดียวกันระหว่าง widget และเพิ่ม `issue`/`expiry_bucket` เฉพาะเส้นที่รองรับตามสเปก ไม่ส่ง query parameter ที่ endpoint ไม่รองรับ และเก็บบริบท filters/page เมื่อกลับจากหน้ารายละเอียด

หลาย request เป็นข้อมูลสดตามสเปกเดิม จึงอาจเห็นยอดต่างกันชั่วคราวหากมีการแก้ทะเบียนระหว่างโหลด ไม่ต้องเพิ่ม snapshot API ใน Phase 1 เว้นแต่มีข้อกำหนดให้ทุก widget ตรงกันในเวลาเดียวกันโดยเคร่งครัด

## 7. สิ่งที่ขอรับจาก backend เพื่อเริ่ม integration

- [ ] ยืนยันนิยามคอมพิวเตอร์และแนวทางกรอง PC + Notebook ใน request เดียว
- [ ] ยืนยัน roles, site scope และ error codes ด้าน auth
- [ ] ส่ง API contract ฉบับยืนยัน พร้อม response examples หรือ OpenAPI
- [ ] แจ้ง base URL ของ environment ทดสอบและวิธีใช้บัญชีทดสอบตามช่องทางของทีม โดยไม่ใส่ token/password ในเอกสารนี้
- [ ] ระบุ endpoint ที่พร้อมใช้งานและกำหนดส่ง Phase 1; แยก loans/repairs Phase 2 ให้ชัดเจน
- [ ] เตรียมข้อมูลทดสอบสำหรับ null, ไม่มีผลลัพธ์, หลายหน้า, identifier ซ้ำ และวันสัญญาไม่ตรงกัน
- [ ] ส่งไฟล์ export ตัวอย่างและยืนยัน headers/CORS สำหรับ browser

## 8. เกณฑ์ตรวจร่วมเพิ่มเติมจากสเปกเดิม

- [ ] ตัวกรองกลุ่มประเภทหรือหลายประเภทให้ขอบเขตเดียวกันทุก endpoint ที่เกี่ยวข้อง
- [ ] เมื่อใช้ filters ฐานเดียวกันและไม่มี issue/expiry filter เพิ่ม ยอด summary เท่ากับ equipment.pagination.total บนข้อมูลทดสอบคงที่
- [ ] ตารางและ export ใช้ filters เดียวกันรวม issue/expiry และส่งออกครบทุกแถวภายใต้ข้อจำกัดที่กำหนด
- [ ] ผู้ไม่มี session ไม่ได้รับข้อมูล dashboard และผู้มีสิทธิ์เห็นข้อมูลตาม scope ที่ตกลง
- [ ] API ใหม่ไม่ทำให้ routes เดิมหรือหน้ารายละเอียดอุปกรณ์เดิมเสียพฤติกรรม
- [ ] กรณีทำแผนที่อุปกรณ์ ยอดรวมไม่หายเพราะสำนักงานไม่มี monitored device หรือไม่มีพิกัด

ขอทีม backend ตอบรับหรือเสนอทางเลือกสำหรับข้อ 2 ก่อนเริ่ม integration ส่วนข้อ 4 และข้อมูล hardware/monitoring เพิ่มเติมให้ทำเฉพาะเมื่อยืนยันขอบเขตแล้ว
