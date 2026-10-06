# คำขอเพิ่มตัวกรองวันที่สัญญาใน Office Equipment Dashboard API

วันที่: 6 ตุลาคม 2569

อ้างอิง: `OFFICE_EQUIPMENT_DASHBOARD_API.md` (Phase 1), `FRONTEND_DASHBOARD_AGREEMENT_2026-10-06.md` ข้อ 6

สถานะ: คำขอจาก frontend รอ backend ยืนยัน

## 1. ปัญหา

แท็บสัญญาแสดง badge “วันที่สัญญาไม่ตรงกัน” และจำนวนเครื่องต่อวันที่จาก `start_dates` / `expiry_dates` ได้แล้ว แต่ผู้ใช้ยัง**เปิดดูไม่ได้ว่าเครื่องไหน**มีวันที่ต่างจากส่วนใหญ่ จึงแก้ทะเบียนไม่ได้

ตัวอย่างข้อมูลจริง ณ วันที่ 6 ต.ค. 2569 — สัญญา `บ.63/2569` มี 552 เครื่อง:

```json
"start_dates":  [{ "value": "2026-09-22", "count": 551 }, { "value": "2026-09-23", "count": 1 }],
"expiry_dates": [{ "value": "2029-09-21", "count": 552 }],
"date_inconsistent": true
```

`/dashboard/equipment` ทำเรื่องนี้ไม่ได้ในตอนนี้:

- ไม่มีตัวกรองวันที่ — `contract_start_date=...` ได้ `400 INVALID_QUERY` (ตรวจแล้ว)
- `sort` ไม่มี `contract_start_date` และการเรียงตาม `contract_expiry_date` ไม่ช่วยเมื่อวันสิ้นสุดเท่ากันทุกเครื่อง
- ทางเดียวที่เหลือคือไล่ดูทุกหน้า (552 เครื่อง ≈ 28 หน้า)

## 2. สิ่งที่ขอ

### 2.1 ตัวกรองวันที่แบบตรงตัว — `/equipment` และ `/export`

| Param | ความหมาย |
|---|---|
| `contract_start_date` | วันเริ่มสัญญาเท่ากับค่านี้ |
| `contract_expiry_date` | วันสิ้นสุดสัญญาเท่ากับค่านี้ |

- รูปแบบ `YYYY-MM-DD` ตรงตัว — **ต้องรับทุกค่าที่ `/contracts` คืนใน `start_dates[].value` / `expiry_dates[].value`** ซึ่งในข้อมูลจริงมี `0000-00-00` และปี พ.ศ. เช่น `2559-09-01` ด้วย ห้ามปฏิเสธค่าที่ระบบคืนมาเอง
- ค่าที่ไม่ใช่รูปแบบนี้ → `400 INVALID_QUERY` พร้อม `error.field`
- ใช้ AND กับ filters อื่นทั้งหมด รวม `equipment_group`, `issue`, `expiry_bucket`
- `/export` รับเหมือน `/equipment` (ไม่มี page/limit) และแสดงค่าที่ใช้ใน sheet **Filters**
- เส้นอื่น (`selectors`, `summary`, `distribution`, `quality`, `contracts`, Phase 2) **ไม่ต้องรับ** — คง `400` สำหรับ param นี้ตามกติกาเดิม

### 2.2 กลุ่มที่ไม่มีวันที่ — ขยาย `missing_field`

- เพิ่มค่า `missing_field=contract_start_date` และ `missing_field=contract_expiry_date` (ว่าง = NULL ตามนิยามเดิม)
- ใช้ได้ที่ `/equipment` และ `/export` เท่านั้น
- ส่งพร้อมตัวกรองวันที่ของฟิลด์เดียวกัน → `400` (กติกาเดียวกับ dimension อื่น)
- ใช้คู่กับ `contract_no` ได้ตามปกติ (คนละ dimension)

ใช้เปิดรายการของแถว `{ "value": null }` ใน `start_dates` / `expiry_dates`

### 2.3 (ถ้าทำได้) เรียงตามวันเริ่มสัญญา

เพิ่ม `sort=contract_start_date` ใน `/equipment` และ `/export` โดยใช้ tie-breaker เดียวกับ sort อื่น

## 3. เกณฑ์ตรวจรับ

1. ทุกสัญญาที่ `date_inconsistent: true`: สำหรับแต่ละค่าใน `start_dates`
   - `GET /equipment?contract_no=<c>&contract_start_date=<value>` → `pagination.total` เท่ากับ `count`
   - ค่า `null` ใช้ `missing_field=contract_start_date` แทน และได้ `count` เช่นกัน
   - ทำแบบเดียวกันกับ `expiry_dates` / `contract_expiry_date`
2. ใช้ `contract_no=บ.63/2569&contract_start_date=2026-09-23` → ได้ 1 เครื่อง
3. ใช้ `contract_start_date=0000-00-00` และ `contract_start_date=2559-09-01` ได้ผลตามจำนวนใน `/contracts` (ไม่ใช่ 400)
4. ส่งค่าเหล่านี้แล้วได้ `400`:
   - `contract_start_date=2026-9-1`
   - param ซ้ำ
   - ตัวกรองวันที่พร้อม `missing_field` ของฟิลด์เดียวกัน
   - ตัวกรองวันที่ที่ส่งไป `/summary`
5. `/export` ที่ใช้ filter และ sort เดียวกันได้ ID และลำดับตรงกับการไล่ `/equipment` ทุกหน้า

## 4. สิ่งที่ frontend จะทำเมื่อพร้อม

- ในแท็บสัญญา ทุกวันที่จะกดได้ เช่น “2026-09-23 (1)” แล้วเปิดแท็บรายการอุปกรณ์ด้วย
  - `contract_no` ของสัญญานั้น
  - ตัวกรองวันที่ หรือ `missing_field` ถ้ากดค่า “ไม่มีวันที่”
  - `expiry_bucket` ที่ใช้อยู่ เพื่อให้จำนวนตรงกับที่เห็น
- แสดงตัวกรองเป็น chip ลบได้ เก็บใน URL และ export ตามตัวกรองนี้
- ยังไม่เปิดใช้จนกว่าจะทดสอบกับ environment จริงตามข้อ 3

## 5. ข้อสังเกตข้อมูล (แยกจากคำขอนี้)

ทะเบียนมีวันที่ `0000-00-00` และปี พ.ศ. ใน column วันที่ ซึ่งทำให้ `expiry_bucket` (หมดสัญญาแล้ว / ไม่มีวันสิ้นสุด) นับเพี้ยนได้ ขอให้พิจารณาแนวทางแก้ข้อมูลแยกต่างหาก เมื่อตัวกรองนี้พร้อม ผู้ใช้จะเปิดรายการเครื่องที่ต้องแก้จากแท็บสัญญาได้โดยตรง
