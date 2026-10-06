# แผนพัฒนา Frontend — Office Equipment Dashboard

วันที่: 6 ตุลาคม 2569

อ้างอิง API: `OFFICE_EQUIPMENT_DASHBOARD_API.md` ฉบับที่มี implementation Phase 1/2, equipment_group และการล้างวันที่ด้วย `"-"`

สถานะ: แผนสำหรับดำเนินงานต่อ ยังไม่ได้ implement หน้าจอหรือรับรอง integration จากการจัดทำแผนนี้

## 1. เป้าหมายและขอบเขต

เพิ่มภาพรวมคอมพิวเตอร์ในหน้าหลัก และหน้ารายละเอียด dashboard ที่ใช้ filters ร่วมกันสำหรับ KPI, การกระจายอุปกรณ์, คุณภาพข้อมูล, รายการอุปกรณ์ และสัญญา พร้อม export หลังเข้าสู่ระบบ

พัฒนาแท็บยืม-คืนและงานแจ้งซ่อมตาม Phase 2 โดยต้องเข้าสู่ระบบ ส่วนการเปิดให้ใช้งานจริงรอยืนยันสิทธิ์และ environment ตามเอกสาร backend

ปรับฟอร์มทะเบียนเดิมให้รองรับ Wi-Fi MAC และอ่านค่าที่ server จัดเก็บจริงหลังบันทึก โดยคงการส่ง `"-"` เมื่อผู้ใช้ลบค่าเดิม รวมวันเริ่ม/สิ้นสุดสัญญา

## 2. รูปแบบหน้าและการนำทาง

### หน้าหลัก `/`

หน้าปัจจุบันแสดง `SitesMap` โดยตรงผ่าน `App.jsx` ให้เพิ่ม component ครอบหน้าหลักที่มีส่วนสรุปคอมพิวเตอร์และแผนที่เดิม:

- การ์ดคอมพิวเตอร์ทั้งหมด, PC, Notebook และไม่มีผู้ครอบครอง
- ใช้ `/summary?equipment_group=computer`; ไม่รวม Monitor ในจำนวนคอมพิวเตอร์
- ปุ่ม “ดูรายละเอียดคอมพิวเตอร์” ไป dashboard พร้อม scope computer
- กดการ์ด PC/Notebook/ไม่มีผู้ครอบครองไปตารางพร้อมตัวกรองที่ตรงกับความหมาย
- ไม่แสดงยอด 0 แทนข้อมูลที่ยังโหลดหรือโหลดผิดพลาด
- โหลด/แสดง error ของส่วนคอมพิวเตอร์แยกจากแผนที่
- จัด layout แผนที่และการ์ดให้รองรับ desktop/mobile และตรวจความสูงแผนที่หลังเปลี่ยนโครงหน้า

รุ่นแรกไม่เพิ่มยอดอุปกรณ์ลงบนหมุดแผนที่ และไม่ใช้ตัวกรองออนไลน์/ขัดข้องของเครือข่ายกรองทะเบียนคอมพิวเตอร์

### หน้าใหม่ `/office-equipment-dashboard`

เพิ่ม route, title และเมนูใน sidebar ตามระบบนำทางเดิมของแอป ไม่เพิ่ม router library เพียงเพื่อหน้านี้

แบ่งแท็บ:

| แท็บ | เนื้อหา | สิทธิ์ |
|---|---|---|
| ภาพรวม | KPI, กราฟการกระจาย, ข้อมูลที่ควรตรวจสอบ | Public |
| รายการอุปกรณ์ | ตาราง, ค้นหา, sort, pagination, export | Public; export ต้อง login |
| สัญญา | วันเริ่ม/สิ้นสุด, ใกล้หมด, วันไม่ตรงกัน | Public |
| ยืม-คืน | Summary และรายการ loan | Login และเปิดเมื่อผ่านเกณฑ์ Phase 2 |
| งานแจ้งซ่อม | Summary และจำนวนงานต่ออุปกรณ์ | Login และเปิดเมื่อผ่านเกณฑ์ Phase 2 |

ค่าเริ่มต้นเป็นกลุ่ม “คอมพิวเตอร์ (PC + Notebook)” มีตัวเลือก “อุปกรณ์ทั้งหมด” ซึ่งไม่ส่ง equipment_group การเลือกประเภทภายในกลุ่มใช้ AND ตาม API

ใช้ query string เก็บแท็บ filters, page, limit และ sort ที่จำเป็นสำหรับเปิดลิงก์ซ้ำ/กลับจากรายละเอียด โดยแยกตัวแปรของ UI ออกจาก query ที่ส่ง API

## 3. โครงสร้างโค้ดที่เสนอ

ใช้ React, Recharts และรูปแบบ CSS/components ที่มีอยู่ในโครงการ

| ไฟล์/กลุ่มไฟล์ | หน้าที่ |
|---|---|
| `src/components/HomeOverview.jsx` | ประกอบส่วนสรุปคอมพิวเตอร์กับ SitesMap |
| `src/components/office-dashboard/OfficeEquipmentDashboard.jsx` | โครงหน้า แท็บและบริบท filters |
| `src/components/office-dashboard/officeDashboardData.js` | Query allowlist, fetch JSON, export, normalization ที่จำเป็น |
| `src/components/office-dashboard/officeDashboardState.js` | อ่าน/เขียน URL, validation state และ merge drill-down |
| `src/components/office-dashboard/useOfficeDashboardResource.js` | Request lifecycle, abort, timeout, retry และป้องกัน response เก่าทับค่าใหม่ |
| Components ใน `office-dashboard` | Filters, summary, distribution, quality, equipment, contracts, loans, repairs |
| `src/components/office-dashboard/OfficeEquipmentDashboard.css` | Layout responsive และสถานะ UI |
| `src/App.jsx`, `src/components/Sidebar.jsx` | Route, title, navigation, token และ login return path |
| `src/components/equipment-form/*`, `EquipmentDetails.jsx` | Wi-Fi MAC, serialization, validation และค่าหลังบันทึก |

ใช้ components เดิมร่วมเมื่อเหมาะสม ไม่ย้ายโครงสร้างส่วนอื่นของระบบโดยไม่จำเป็น

## 4. Data flow และ filters

### Filters ฐาน

รองรับ equipment_group, contract_no, pea_site_id, department, equipment_type, status, search และ missing_field ตาม contract

- ค้นหา debounce และยกเลิก request เก่าเมื่อผู้ใช้เปลี่ยนค่า
- ใช้ URLSearchParams เพื่อ encode ภาษาไทย slash และ timezone offset
- ใช้ selectors จาก backend; ค่า null แสดง “ไม่ระบุ” และส่ง missing_field
- missing_field รองรับหนึ่ง dimension เท่านั้น: UI อนุญาตตัวเลือก “ไม่ระบุ” ได้ครั้งละหนึ่งมิติ พร้อมคำอธิบายเมื่อจะเปลี่ยนมิติ
- ไม่ส่ง exact filter ของ dimension เดียวกับ missing_field
- เปลี่ยน filters/sort/limit แล้ว reset page ของรายการที่เกี่ยวข้องเป็น 1
- เมื่อเปลี่ยน group ให้ล้างประเภทที่ไม่อยู่ในกลุ่มที่เลือก และโหลด selectors ใหม่
- ไม่ใช้ค่า count ของ selectors แทน summary เพราะแต่ละ dimension มีขอบเขตต่างกัน

### Endpoint-specific query

สร้าง query ตาม allowlist ของแต่ละเส้น ไม่กระจาย state ทั้งหน้าลง query โดยตรง:

| Endpoint | Query เพิ่มจาก filters ฐาน |
|---|---|
| selectors, summary, quality | ไม่มี pagination หรือ issue/expiry |
| distribution | group_by, page, limit, sort, order |
| equipment | issue, expiry_bucket, page, limit, sort, order |
| contracts | expiry_bucket, page, limit, sort, order |
| export | เหมือน equipment แต่ไม่มี page/limit |
| loans | loan_status, from, to, page, limit, sort, order |
| repairs | from, to, page, limit, sort, order |

เมื่อ drill-down ให้รวมกับ filters เดิมโดยแทนค่ามิติที่ถูกเลือก และล้างตัวกรองมิติเดียวกันที่ขัดกัน ไม่ต่อ query ซ้ำ หากการ drill-down ต้องใช้ missing_field อีกมิติที่ API รวมพร้อมกันไม่ได้ ให้ผู้ใช้ทราบข้อจำกัดและเลือกเปลี่ยนเงื่อนไขก่อน ไม่แสดงว่าเป็น subset เดิมอย่างเงียบ ๆ

### Request lifecycle

- โหลด summary/selectors และส่วนที่มองเห็นพร้อมกันได้; โหลดตารางสัญญาและ Phase 2 เมื่อเปิดแท็บ
- แต่ละ widget มี loading, empty, error และ retry ของตัวเอง
- ยกเลิก request เมื่อเปลี่ยน filters/ออกหน้า และตรวจ request key ก่อนนำผลมาแสดง
- ถ้าคงข้อมูลเก่าระหว่าง refresh ต้องระบุว่ากำลังอัปเดตและไม่ให้กด drill-down/export ด้วย filters ใหม่ที่ยังไม่ตรงกับข้อมูลที่เห็น
- แสดงเวลา generated_at ว่าเป็นเวลาสร้างผล ไม่ใช่เวลาแก้ทะเบียนล่าสุด
- รุ่นแรกโหลดเมื่อเข้าหน้า เปลี่ยน filter หรือกด refresh; ไม่ผูก polling กับแผนที่เครือข่าย

## 5. Phase 1: รายละเอียดการแสดงผล

### ภาพรวม

- total_equipment แสดงตาม scope ที่เลือก โดยแยกคำว่าเครื่องคอมพิวเตอร์กับรายการอุปกรณ์
- by_type/by_status รองรับค่า null และค่าที่ไม่เคยพบโดยไม่ hardcode รายการ
- registered_site_count คือจำนวนสำนักงาน
- กราฟการกระจายมี pagination และระบุว่าแสดงกลุ่มในหน้าปัจจุบัน ไม่ใช้ผลหน้าแรกเป็นยอดครบทุกกลุ่ม
- ใช้ meta.equipment_total เป็นจำนวนอุปกรณ์ และ pagination.total เป็นจำนวนกลุ่ม
- Quality ใช้ equipment_with_issues เป็นจำนวนอุปกรณ์ที่ควรตรวจสอบ ไม่บวก issue counts แทนจำนวนเครื่อง
- Expiry 90/180/365 เป็นยอดสะสม แสดงเป็นการ์ดแยกหรือแปลงช่วงโดยหักลบก่อนทำกราฟแบ่งส่วน

### ตารางอุปกรณ์

- แสดงชื่อ/ประเภท/รหัส/Serial/สำนักงาน/ผู้ครอบครอง/สถานะ และคอลัมน์รายละเอียดเพิ่มเติมตามขนาดจอ
- แสดง quality_issues เป็น badge และค่าที่ไม่มีข้อมูลเป็นเครื่องหมายแทนโดยไม่แก้ข้อมูล
- Sort ที่ server ตาม allowlist; ไม่เรียงเฉพาะหน้าปัจจุบันแล้วอ้างว่าเรียงทั้งชุด
- กดแถวไป `/equipment/:id` เดิม และ Back กลับมาพร้อม filters/page เดิม
- รองรับ totalPages=0 และหน้าเกิน; ปรับไปหน้าที่เหมาะสมโดยไม่วน request ไม่สิ้นสุด

### สัญญา

- แสดงจำนวนอุปกรณ์ที่ผ่านเงื่อนไข ไม่อ้างว่าเป็นทุกเครื่องของสัญญาหากกรอง expiry อยู่
- date_inconsistent แสดง “วันที่สัญญาไม่ตรงกัน” โดยไม่ระบุจำนวนเครื่อง
- รองรับหลายวัน/null; ไม่เลือกวันเดียวมาอ้างเป็นวันของทั้งสัญญา
- กดดูรายการส่ง contract/missing_field และ expiry filter ไป equipment

## 6. Export และ auth

- ไม่ต้อง login เพื่อดู Phase 1
- กด export ขณะไม่มี session ให้ใช้ login flow เดิมและรักษา URL/filters เพื่อกลับมาที่บริบทเดิม จากนั้นผู้ใช้กดดาวน์โหลดได้
- ส่ง Bearer token ผ่าน fetch; ป้องกันการกดส่งซ้ำขณะกำลังดาวน์โหลด
- ตรวจ response.ok และ Content-Type ก่อนสร้าง Blob; JSON error ไม่ถูกบันทึกเป็น xlsx
- อ่านชื่อไฟล์จาก Content-Disposition พร้อม fallback
- อ่าน X-Export-Total แบบแยก header ไม่มีค่าออกจากเลข 0 ไม่ใช้ Number(null) เป็นจำนวนส่งออก
- Revoke object URL หลังใช้งาน
- ใช้ authSession เดิมสำหรับ session หมดอายุ; 403/503 ไม่ logout
- 422 แสดงคำแนะนำให้จำกัด filters เพิ่ม

Export นี้เป็นรายการอุปกรณ์ตาม API ไม่เพิ่มปุ่ม export ประวัติ loans/repairs โดยอ้างว่า endpoint เดิมส่งออกข้อมูลเหล่านั้นได้

## 7. ฟอร์มทะเบียนและรายละเอียดเดิม

1. เพิ่ม wifi_mac_address ใน field definitions, draft, payload, หน้าแสดงรายละเอียด และ validation
2. Normalize ค่าจริงของ Wi-Fi MAC เป็นรูปแบบมาตรฐานที่ UI ใช้อยู่ ทั้งตอน blur และก่อน submit
3. ช่องที่เคยมีค่าแล้วผู้ใช้ลบ ส่ง `"-"` รวมวันที่สัญญาสองฟิลด์ตาม contract ล่าสุด
4. จำกัด sentinel ตาม allowlist; ช่องบังคับและ site ID ยังผ่าน validation ตามเดิม
5. แยก error ของฟอร์มทะเบียนที่ส่ง message ออกจาก dashboard error.message
6. เมื่อบันทึกสำเร็จ อ่าน GET รายละเอียดเพื่อคืนค่าที่ server normalize และอัปเดต baseline ให้ตรงฐานข้อมูล
7. หากมีการพิมพ์ต่อระหว่าง save/GET ให้รักษา draft ที่แก้ใหม่ ไม่เขียนผลอ่านกลับทับการแก้ไขล่าสุด
8. หาก save สำเร็จแต่ GET ล้มเหลว แสดงว่า “บันทึกแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ” และให้ retry การอ่าน ไม่ส่งบันทึกซ้ำอัตโนมัติ
9. รองรับ success แบบ no changes ที่ไม่มี data

## 8. Phase 2: ยืม-คืนและงานแจ้งซ่อม

- โหลดข้อมูลเมื่อมี token เท่านั้น หากยังไม่ล็อกอินแสดงทางเข้าสู่ระบบ
- ผูกผลโหลดกับ session ปัจจุบัน เมื่อ logout/เปลี่ยนบัญชีให้ยกเลิก request และล้างข้อมูลประวัติที่แสดงอยู่
- Loans ใช้ data.summary และ data.items; แยกหน่วย “รายการยืม” กับ “อุปกรณ์ที่ไม่ซ้ำ”
- Summary เปลี่ยนตาม loan_status ไม่แสดงว่าเป็นยอดทุกสถานะเมื่อกรองอยู่
- due_date=null แสดง “ไม่ระบุกำหนดคืน”; ใช้ is_overdue จาก backend
- batch แสดงเฉพาะสมาชิกในหน้าปัจจุบัน ไม่เดาสมาชิกหน้าอื่น
- Date range สร้าง from/to คู่กันเป็น RFC3339 มี offset; วันสิ้นสุดที่ผู้ใช้เลือกแปลงเป็นต้นวันถัดไปในเวลาไทย
- Loans ระบุว่าเป็นช่วงวันที่เริ่มยืม ไม่ใช่ยอดค้างทั้งหมด ณ วันนั้น
- Repairs ใช้ summary.repair_job_count และระบุ last_reported_at ว่าวันแจ้งล่าสุด
- ลิงก์รายละเอียดรายเครื่องแสดงประวัติทั้งหมด ไม่อ้างว่ากรองตามช่วง dashboard
- ทำ feature flag สำหรับซ่อน Phase 2 จนกว่าจะติดตั้ง endpoints รุ่นที่ตกลงและยืนยันสิทธิ์เปิดใช้

## 9. ลำดับ implementation และเกณฑ์จบแต่ละช่วง

| ช่วง | งาน | เกณฑ์จบ |
|---|---|---|
| 1 | Data/query/state helpers และ fixtures จาก schema | สร้าง query ถูกเส้น, parse response และป้องกัน stale response ได้ |
| 2 | ฟอร์ม Wi-Fi MAC/วันที่/อ่านกลับ | ล้างค่าเดิมส่ง dash, validation ถูกต้อง, draft ใหม่ไม่ถูก GET ทับ |
| 3 | Route/sidebar/หน้าหลักและ summary | แผนที่เดิมยังใช้ได้, การ์ดโหลดแยกและเปิด dashboard ถูก scope |
| 4 | Filters/ภาพรวม/equipment/contracts | Drill-down, pagination และ Back/Forward รักษาบริบทได้ |
| 5 | Export และ login return | ดาวน์โหลดได้ตรง filters และจัดการ error โดยไม่สร้างไฟล์ผิด |
| 6 | Phase 2 หลัง feature flag | Loans/repairs ใช้ auth, summary และวันที่ตรงนิยาม |
| 7 | Integration และ responsive review | ผ่าน checklist กับ environment จริงและบันทึกผลก่อนเปิดใช้งาน |

ไม่ต้องรอ Phase 2 เพื่อส่งมอบ UI Phase 1 แต่ไม่เปิด equipment_group กับ environment ที่ยังไม่รองรับ และไม่ fallback เป็นข้อมูลทั้งหมดอย่างเงียบ ๆ

## 10. การทดสอบ

### Automated tests ที่จำเป็น

- Query allowlist, encoding, group/type AND, missing_field conflicts และ export ไม่ส่ง page/limit
- URL round-trip และการ merge drill-down ไม่ทำ filters เดิมหายหรือซ้ำ
- Form payload เมื่อล้างข้อความ/วันเริ่ม/วันสิ้นสุด/ทั้งคู่ และ Wi-Fi MAC ถูก/ผิด
- การบันทึกสำเร็จแต่โหลดกลับล้มเหลว และการรักษา draft ที่แก้ขณะ request ทำงาน
- Pagination ว่าง/หน้าเกิน, response เก่าหลังเปลี่ยน filter/session ไม่ทับ state ใหม่
- ช่วงวันที่ไทยและ exclusive end ของ Phase 2
- Export JSON error, Content-Type ไม่ตรง, header ไม่มีค่า และจำนวน 0

ใช้ node:test ตามรูปแบบเดิมของ repository สำหรับ pure helpers และเลือกทดสอบ component/flow เพิ่มเฉพาะส่วนที่ pure tests ไม่ครอบคลุม

### Integration และ manual checks

- [ ] Dev URL/รุ่น backend/migrations/auth ตรงกับ contract ล่าสุด
- [ ] Public Phase 1 ใช้ได้โดยไม่มี token; export/Phase 2 ไม่มี token ต้องได้ 401
- [ ] equipment_group=computer ได้เฉพาะ PC/Notebook และใช้ AND กับประเภท
- [ ] KPI, drill-down และยอดตารางตรงกันบนข้อมูลทดสอบคงที่
- [ ] Distribution/contracts ไม่สับสนจำนวนกลุ่มกับจำนวนอุปกรณ์
- [ ] Form ล้างแต่ละวันที่/ทั้งคู่/ข้อความ/Wi-Fi MAC แล้ว GET กลับเป็น null
- [ ] ค่าผิดรูปแบบได้ 400 โดยไม่เปลี่ยนข้อมูล
- [ ] Export ใน browser ต่าง origin อ่าน headers ได้และแถวตรง filters/sort
- [ ] Loans/repairs แสดง summary ก่อน pagination, due_date null และจำนวนงานไม่ซ้ำถูกต้อง
- [ ] 401 ปัจจุบันจบ session อย่างถูกต้อง; 403/503 ไม่ล้าง session
- [ ] Mobile, keyboard, labels, loading/error และตารางเลื่อนได้โดยไม่ทำทั้งหน้าล้น
- [ ] เปิดลิงก์ตรง, refresh, Back/Forward และกลับจากรายละเอียดรักษาบริบท
- [ ] หน้าเดิม: แผนที่, ค้นหา/แก้ไขอุปกรณ์, งานแจ้งปัญหา, ประวัติ speed test และพิกัดไม่เสียพฤติกรรม
- [ ] รัน build และ checks ที่เกี่ยวข้องกับไฟล์ที่เปลี่ยน; แยกบันทึกปัญหาเดิมออกจาก regression ใหม่

ใช้ข้อมูลหรือทะเบียนทดสอบที่กำหนดสำหรับ mutation ไม่ใช้ทะเบียนจริงสำคัญเพียงเพื่อทดสอบการล้างค่า

## 11. สิ่งที่ต้องมีจาก backend/environment

- API host/dev URL, รุ่นหรือ commit ที่ติดตั้ง และผู้รับผิดชอบ environment
- Migrations/model/auth middleware ที่ dashboard ต้องใช้พร้อมใช้งาน
- บัญชีและข้อมูลสำหรับ integration ตามช่องทางทีม ไม่ใส่ credentials ในเอกสาร
- ผลยืนยันการเปิด Phase 2 แบบ authenticated ก่อนเปิด feature flag จริง

ผล automated tests ที่ backend รายงานเป็นข้อมูลประกอบ ไม่แทนผล integration ของ frontend ต้องบันทึกรุ่นที่ทดสอบ กรณีทดสอบ และข้อจำกัดที่ยังเหลือก่อนรับรองพร้อมใช้งาน
