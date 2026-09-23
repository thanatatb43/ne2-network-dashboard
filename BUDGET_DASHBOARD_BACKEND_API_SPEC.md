# API Contract สำหรับปรับปรุง Budget Dashboard

วันที่จัดทำ: 23 กันยายน 2026  
สถานะ: ข้อกำหนดเสนอสำหรับทีม Backend ก่อนเริ่มพัฒนา Frontend

เอกสารนี้ต่อยอดจาก [BUDGET_DASHBOARD_IMPROVEMENT_PLAN.md](BUDGET_DASHBOARD_IMPROVEMENT_PLAN.md) และตั้งใจให้คง feature ปัจจุบันทั้งหมด โดยเฉพาะการคลิกการ์ด/แท่งกราฟเพื่อเปิดรายการธุรกรรมที่กรองตามบริบทนั้น

## 1. ข้อตกลงหลัก

- Prefix ทุก endpoint: `/api/budgets`
- จำนวนเงินทุกจุดส่งเป็น **decimal string** ที่มีทศนิยม 2 ตำแหน่ง เช่น `"1250.00"` เพื่อไม่สูญเสียความแม่นยำของเงินจาก floating point; frontend เป็นผู้ format เป็น `th-TH` / `THB`
- วันส่งแบบ ISO 8601: วันที่ `YYYY-MM-DD`, เวลา UTC `YYYY-MM-DDTHH:mm:ss.sssZ`
- `fiscal_year` เป็น ค.ศ. 4 หลัก เช่น `2026`; frontend แสดง พ.ศ. ได้ แต่ห้ามส่ง พ.ศ. เป็น query
- identifier ส่งเป็น string เสมอ แม้ฐานข้อมูลเก็บเป็น integer
- response สำเร็จใช้ envelope เดียวกัน:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "generated_at": "2026-09-23T04:00:00.000Z",
    "currency": "THB"
  }
}
```

- response ผิดพลาดใช้ HTTP status ที่ถูกต้อง และ envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "fiscal_year must be between 2023 and 2100",
    "fields": { "fiscal_year": "Invalid value" }
  },
  "request_id": "req_..."
}
```

- อย่าส่ง SQL/database error หรือข้อมูล transaction อื่นใน error; log ฝั่ง server ผูกด้วย `request_id`
- กำหนดสิทธิ์จาก backend เป็นแหล่งจริงเสมอ ไม่เชื่อ role ที่ส่งจาก browser ข้อเสนอเริ่มต้นคือคงสิทธิ์ read ตามหน้าเดิม หากต้องจำกัดข้อมูลตามหน่วยงาน/role ให้ตัดสินใจก่อนเปิด endpoint ใหม่

## 2. Endpoint ที่ต้องมี

| ลำดับ | Method / path | สถานะ | หน้าที่ |
|---|---|---|---|
| 1 | `GET /api/budgets/dashboard/summary` | เพิ่ม | ภาพรวมหนึ่งปี: cards, รายการบัญชี, Top ผู้เบิกจ่าย และ metadata ใน request เดียว |
| 2 | `GET /api/budgets/transactions` | เพิ่ม | ค้นหา/กรอง/เรียง/แบ่งหน้าธุรกรรม ฝั่ง server; รองรับ drill-down จากกราฟและ deep link |
| 3 | `GET /api/budgets/transactions/aggregates` | เพิ่ม | ยอดรวมและกราฟรายเดือนของ **filter เดียวกับข้อ 2** โดยไม่ต้องส่ง transaction ทุกแถว |
| 4 | `GET /api/budgets/transactions/selectors` | ปรับ contract | ตัวเลือกค้นหาแบบมี value/label และ filter ตามปีได้ |
| 5 | `GET /api/budgets/transactions/:transaction_id` | เพิ่ม | รายละเอียดหนึ่งธุรกรรม สำหรับ mobile detail, row expansion และ future link งานแจ้งปัญหา |
| 6 | `GET /api/budgets/summary/:year` | คงชั่วคราว | endpoint เดิม ให้ response เดิมจน frontend รุ่นใหม่ใช้งานจริง |
| 7 | `POST /api/budgets/transactions/find` | คงชั่วคราว | endpoint เดิม ให้ใช้ต่อได้ระหว่าง migration; ระบุวันเลิกใช้เมื่อ frontend ใหม่ deploy แล้ว |

ไม่จำเป็นต้องทำ endpoint แยกต่อแต่ละแท่งกราฟ: ให้ frontend ส่ง filter ไป `/transactions` และ `/aggregates` contract เดียวกัน จะรองรับกราฟใหม่โดยไม่เพิ่ม API ทุกครั้ง

## 3. Common filter contract

ใช้ query parameter ชุดเดียวกันกับ `GET /transactions` และ `GET /transactions/aggregates`:

| Parameter | ชนิด / ตัวอย่าง | ความหมาย |
|---|---|---|
| `fiscal_year` | `2026` | ปีงบประมาณ; optional หากผู้ใช้เลือกทุกปี |
| `account_code` | `53032070` | รหัสบัญชี/หมวดงบที่ใช้ใน summary และกราฟ comparison |
| `cost_center` | `CC-001` | ศูนย์ต้นทุนจริง หากต่างจาก account code |
| `clearing_account_code` | `110100` | รหัสบัญชีหักล้าง |
| `clearing_account_name` | URL encoded text | ชื่อบัญชีหักล้าง; backend ตีความแบบ case-insensitive contains ตาม policy ที่ประกาศ |
| `username` | `somchai` | ผู้บันทึก/ผู้ใช้ที่ปรากฏใน Top user chart |
| `reference_doc_no` | `DOC-2026-001` | เลขเอกสารอ้างอิง |
| `description` | URL encoded text | รายละเอียดรายการ; contains search ตาม policy ที่ประกาศ |
| `posting_month` | `2026-04` | เดือนสำหรับคลิกแท่ง/จุดในกราฟรายเดือน |
| `date_from`, `date_to` | `2026-04-01` | ช่วงวัน posting; validate `from <= to` |
| `amount_direction` | `debit`, `credit`, `all` | ความหมายต้องผูกกับ accounting definition จากเจ้าของข้อมูล ไม่ใช้ชื่อ “ไม่เบิกจ่าย” ที่กำกวม |

### กติกา filter

- หลาย filter ใช้ AND; `description`, `reference_doc_no`, `username`, `clearing_account_name` ใช้ partial match ที่ escape wildcard เพื่อป้องกันผลผิดคาด
- `posting_month` ต้องอยู่ใน `fiscal_year` หากส่งทั้งคู่; response `400 INVALID_QUERY` เมื่อขัดกัน
- ยอมรับ `cost_center` ใน endpoint เดิมตาม contract เดิม แต่ endpoint ใหม่ **แยก `account_code` กับ `cost_center` ให้ชัด**
- ปัจจุบัน frontend ส่ง `cost_center` เพื่อกรองข้อมูลที่ summary เรียก `account_code`; backend ต้องยืนยัน mapping ก่อน migration และรองรับ alias เดิมชั่วคราวพร้อม `meta.deprecations`
- ห้ามรับ SQL fragment, field name หรือ arbitrary sort จาก client

## 4. GET /api/budgets/dashboard/summary

### Request

```http
GET /api/budgets/dashboard/summary?fiscal_year=2026&top_users_limit=10
Authorization: Bearer <token>   # ส่งเมื่อ endpoint ต้องใช้สิทธิ์
```

| Parameter | Required | Validation |
|---|---:|---|
| `fiscal_year` | yes | ปีที่มีในระบบหรือช่วง 2023–2100; ตัดสิน final กับ data owner |
| `top_users_limit` | no | default 10, min 1, max 20 |

### Response

```json
{
  "success": true,
  "data": {
    "fiscal_year": 2026,
    "period": {
      "start_date": "2025-10-01",
      "end_date": "2026-09-30",
      "data_through": "2026-09-20"
    },
    "totals": {
      "allocated": "1500000.00",
      "spent": "870000.00",
      "remaining": "630000.00",
      "usage_percentage": "58.00",
      "average_monthly_spent": "96666.67"
    },
    "accounts": [
      {
        "account_code": "53032070",
        "account_name": "ค่าอุปกรณ์สื่อสาร",
        "allocated": "500000.00",
        "spent": "320000.00",
        "remaining": "180000.00",
        "usage_percentage": "64.00",
        "transaction_count": 42,
        "top_users": [
          { "username": "somchai", "display_name": "สมชาย ใจดี", "spent": "120000.00", "transaction_count": 8 }
        ]
      }
    ]
  },
  "meta": {
    "generated_at": "2026-09-23T04:00:00.000Z",
    "currency": "THB",
    "source_updated_at": "2026-09-20T08:30:00.000Z"
  }
}
```

### ความหมายข้อมูล

- `totals` ไม่ต้องใช้ row พิเศษชื่อ “รวมทั้งหมด”; backend ส่ง total แยกเสมอ
- `accounts` ไม่รวม total row, sort ตาม `spent DESC` เป็น default และ `account_code` เป็น tie-breaker เพื่อสี/ลำดับกราฟเสถียร
- `top_users` ผูกกับแต่ละ `account_code`, เรียง `spent DESC`, ไม่ส่งเกิน `top_users_limit`; `display_name` เป็น optional และต้องผ่าน policy privacy ก่อนส่ง
- `transaction_count` ทำให้ frontend อธิบายขนาดชุดข้อมูลก่อนคลิก drill-down ได้
- ทุก account ต้องมี `account_code` ที่ส่งกลับไปเป็น filter `/transactions?account_code=...` ได้โดยตรง
- data owner ต้องรับรองสูตร `allocated`, `spent`, `remaining`, `usage_percentage`, `average_monthly_spent` รวมถึงกรณี allocated เป็น 0 และยอดติดลบ

## 5. GET /api/budgets/transactions

### Request

```http
GET /api/budgets/transactions?fiscal_year=2026&account_code=53032070&username=somchai&page=1&page_size=15&sort=posting_date&order=desc
```

เพิ่ม common filters จาก section 3 ได้ทั้งหมด

| Parameter | Default | Validation |
|---|---:|---|
| `page` | 1 | integer ≥ 1 |
| `page_size` | 15 | 10, 15, 25, 50, 100; max 100 |
| `sort` | `posting_date` | allowlist: `posting_date`, `document_date`, `reference_doc_no`, `description`, `account_code`, `cost_center`, `clearing_account_name`, `username`, `amount` |
| `order` | `desc` | `asc` หรือ `desc` |
| `include` | none | comma-separated allowlist `linked_jobs` สำหรับข้อมูลเสริมที่ผู้มีสิทธิ์เท่านั้น |

### Response

```json
{
  "success": true,
  "data": [
    {
      "transaction_id": "txn_01J...",
      "fiscal_year": 2026,
      "document_date": "2026-04-15",
      "posting_date": "2026-04-18",
      "posting_month": "2026-04",
      "reference_doc_no": "DOC-2026-001",
      "description": "จัดซื้ออุปกรณ์สื่อสาร",
      "account_code": "53032070",
      "account_name": "ค่าอุปกรณ์สื่อสาร",
      "cost_center": "CC-001",
      "cost_center_name": "กดส.ฉ.2",
      "clearing_account_code": "110100",
      "clearing_account_name": "เจ้าหนี้การค้า",
      "username": "somchai",
      "amount": "25000.00",
      "amount_direction": "debit",
      "currency": "THB",
      "linked_job_count": 0
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 15,
    "total_items": 42,
    "total_pages": 3
  },
  "applied_filters": {
    "fiscal_year": 2026,
    "account_code": "53032070",
    "username": "somchai"
  },
  "meta": {
    "generated_at": "2026-09-23T04:00:00.000Z",
    "currency": "THB"
  }
}
```

### ข้อกำหนด

- ใช้ `transaction_id` ที่ immutable และ unique; ห้ามให้ frontend ใช้ array index เป็น key
- `amount` เก็บเครื่องหมายตาม ledger จริง; `amount_direction` เป็น semantic flag ที่ backend/data owner รับรอง ช่วยให้ UI อธิบายค่าบวก/ลบได้ถูกต้อง
- `posting_month` เป็น field บังคับสำหรับข้อมูลที่ลงกราฟ; ถ้าไม่มี date ให้ส่ง `null` และไม่นับใน monthly aggregate พร้อม metadata จำนวน record ที่ไม่ถูกนับ
- sort คงที่ด้วย `transaction_id` เป็น tie-breaker เพื่อ pagination ไม่สลับเมื่อมีวันที่เท่ากัน
- `description` และชื่อยาวส่งเต็มข้อความ; frontend ตัดแสดงเองและมีทางเปิดรายละเอียด
- backend ต้องใช้ pagination ที่ database ไม่ใช่โหลดทุก record ขึ้น memory; query จำนวนรวมและ aggregate ต้องมี index ตาม `fiscal_year`, `account_code`, `posting_date`, `username` ตามผล EXPLAIN ของฐานจริง

## 6. GET /api/budgets/transactions/aggregates

ใช้ filter ชุดเดียวกับ endpoint transactions **ยกเว้น** `page`, `page_size`, `sort`, `order` เพื่อให้ยอดและกราฟตรงกับ result set เดียวกัน

### Request

```http
GET /api/budgets/transactions/aggregates?fiscal_year=2026&account_code=53032070
```

### Response

```json
{
  "success": true,
  "data": {
    "totals": {
      "debit": "320000.00",
      "credit": "-15000.00",
      "net": "305000.00",
      "transaction_count": 42
    },
    "by_month": [
      {
        "month": "2026-04",
        "debit": "50000.00",
        "credit": "-2500.00",
        "net": "47500.00",
        "transaction_count": 6
      }
    ],
    "coverage": {
      "first_posting_date": "2025-10-01",
      "last_posting_date": "2026-09-20",
      "records_without_posting_date": 0
    }
  },
  "applied_filters": { "fiscal_year": 2026, "account_code": "53032070" },
  "meta": { "generated_at": "2026-09-23T04:00:00.000Z", "currency": "THB" }
}
```

### ข้อกำหนด

- `by_month` ส่งทุกเดือนในปีงบประมาณตามช่วง `period` แม้ยอดเป็น `"0.00"` เพื่อไม่ให้เส้นกราฟขาด; ถ้าไม่มีข้อมูลทั้งปีให้คืน array ว่างและ `transaction_count: 0`
- field `debit`, `credit`, `net` เป็นชื่อเสนอ ต้องยืนยันกับศัพท์บัญชีจริงก่อน implement; หลังเลือกแล้ว frontend ต้องใช้คำเดียวกันทุก card/legend/tooltip/table
- การคลิกแท่ง/จุดเดือนจะสร้าง `posting_month=YYYY-MM` แล้วเรียก `/transactions`; จึงไม่ต้องเพิ่ม endpoint drill-down รายเดือน
- response ต้องสะท้อน `applied_filters` หลัง normalize เพื่อให้ frontend แสดง chips ที่ตรงกับ backend จริง

## 7. GET /api/budgets/transactions/selectors

### Request

```http
GET /api/budgets/transactions/selectors?fiscal_year=2026&q=comm&limit=20
```

| Parameter | ความหมาย |
|---|---|
| `fiscal_year` | ลด selector ให้เหลือค่าที่ใช้ในปีนั้น; optional สำหรับทุกปี |
| `field` | optional: `account`, `cost_center`, `clearing_account`, `username`, `reference_doc`, `description`; ถ้าไม่ส่งคืนชุด small initial options เท่านั้น |
| `q` | คำค้นของ combobox; normalize/escape ฝั่ง server |
| `limit` | default 20, max 50 |

### Response เมื่อขอ field เดียว

```json
{
  "success": true,
  "data": {
    "field": "account",
    "options": [
      { "value": "53032070", "label": "53032070 — ค่าอุปกรณ์สื่อสาร" }
    ]
  },
  "meta": { "generated_at": "2026-09-23T04:00:00.000Z" }
}
```

### ข้อกำหนด

- ไม่ส่ง parallel arrays เช่น `cost_center[]` กับ `cost_center_name[]`; ใช้ object `value`/`label` เพื่อไม่เสี่ยง index เหลื่อม
- sort options แบบ deterministic และ case-insensitive; deduplicate ฝั่ง backend
- description อาจมีข้อมูลละเอียด/จำนวนมาก: ต้องกำหนดสิทธิ์, redaction และ limit ชัดเจนก่อนส่ง suggestion
- cache ได้ตาม `fiscal_year`, `field`, `q` แต่ client ต้องไม่ถือ cache เป็นแหล่งจริงหลังเปลี่ยนสิทธิ์

## 8. GET /api/budgets/transactions/:transaction_id

ใช้ response `data` field เดียวกับ list และเพิ่มรายละเอียดที่ไม่ควรโหลดทุกแถว เช่น source/import metadata, note, linked jobs เมื่อผู้ใช้มีสิทธิ์

```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_01J...",
    "fiscal_year": 2026,
    "document_date": "2026-04-15",
    "posting_date": "2026-04-18",
    "reference_doc_no": "DOC-2026-001",
    "description": "จัดซื้ออุปกรณ์สื่อสาร",
    "account_code": "53032070",
    "amount": "25000.00",
    "amount_direction": "debit",
    "linked_jobs": [
      { "job_id": "123", "job_name": "ซ่อมอุปกรณ์", "status": "กำลังดำเนินการ" }
    ]
  }
}
```

- `404 TRANSACTION_NOT_FOUND` เมื่อไม่มีหรือผู้ใช้ไม่มีสิทธิ์เห็น record โดยไม่เปิดเผยว่ามี record นั้นอยู่ใน scope อื่น
- ข้อมูล linked job เป็น optional (`include=linked_jobs` หรือ policy role) เพื่อหลีกเลี่ยง N+1 query และข้อมูลเกินสิทธิ์

## 9. Migration จาก API เดิม

### API ที่มีอยู่

| Endpoint เดิม | ปัญหาที่แก้ด้วย contract ใหม่ | การคง compatibility |
|---|---|---|
| `GET /summary/:year` | total row ปนกับ account row, schema ไม่บอก period/data freshness, top users ไม่เป็น contract ชัด | คง response เดิม; endpoint ใหม่ส่ง `totals` แยกและ normalized schema |
| `POST /transactions/find` | POST form-urlencoded, คืน transaction ทั้งหมดให้ browser sort/page, ไม่มี URL deep link | คงไว้ใน release เดิม; frontend ใหม่ย้ายไป `GET /transactions` + `/aggregates` |
| `GET /transactions/selectors` | parallel arrays และ datalist ต้องรอ | เพิ่ม mode `field/q/limit` และ object options โดยไม่ทำลาย response เก่าจน migration เสร็จ |

ขั้นตอน:

1. Backend ออก endpoint ใหม่พร้อม fixture/contract test และคง endpoint เดิมทั้งหมด
2. Frontend ทำ adapter อ่าน schema ใหม่ภายใต้ feature flag หรือ environment toggle
3. ทดสอบตัวเลข total/account/month เทียบ legacy API ในปีจริงอย่างน้อย 2 ปีและทุกกรณี amount ติดลบ
4. เปิดใช้ frontend ใหม่, monitor error/rate/latency และคง fallback ที่กำหนดช่วงเวลาชัดเจน
5. ประกาศ deprecation ของ `POST /transactions/find` พร้อมวันถอด endpoint; ไม่ลบจนไม่มี client ใช้งาน

## 10. HTTP status, performance และ observability

| กรณี | HTTP | error.code |
|---|---:|---|
| Query/filter/sort/page ไม่ถูกต้อง | 400 | `INVALID_QUERY` |
| ไม่มี token หรือ session หมดอายุ เมื่อ endpoint ต้อง login | 401 | `UNAUTHENTICATED` |
| ผู้ใช้ไม่มีสิทธิ์ | 403 | `FORBIDDEN` |
| ไม่มี transaction/detail ตาม id หรือใน scope | 404 | `NOT_FOUND` / `TRANSACTION_NOT_FOUND` |
| เกิน rate limit | 429 | `RATE_LIMITED` |
| แหล่งข้อมูล/import ชั่วคราวใช้ไม่ได้ | 503 | `DATA_SOURCE_UNAVAILABLE` |
| ข้อผิดพลาดไม่คาดคิด | 500 | `INTERNAL_ERROR` |

- เป้าหมายเบื้องต้น (ต้องวัดกับข้อมูลจริง): summary p95 ≤ 1.5s, transactions p95 ≤ 2s ที่ page size 100, aggregates p95 ≤ 2s
- ใส่ `Cache-Control`/ETag สำหรับ summary/selectors ตามรอบ import; transactions ที่มี filter ผู้ใช้ไม่ cache แบบ shared โดยไม่มี `Vary: Authorization`
- log structured อย่างน้อย request_id, endpoint, status, duration_ms, normalized filter names (ไม่ log description/text เต็มหรือ token), result_count, user role/tenant ที่ pseudonymized ตาม policy
- monitor query timeout, error rate, page size distribution และ aggregate/list total mismatch

## 11. Contract tests ที่ Backend ต้องส่งมอบ

- [ ] Summary ปี 2026: `totals` เท่ากับผลรวม `accounts` ตามสูตรที่ตกลง และ account ไม่มี total row แฝง
- [ ] Summary ไม่มีข้อมูล: `200 success`, accounts `[]`, amount `"0.00"` เฉพาะ total ที่ data owner ยืนยันว่าเป็นศูนย์จริง, period/meta ครบ
- [ ] Transaction filter account/user/month ทำ AND และ `applied_filters` ตรงกับ request ที่ normalize แล้ว
- [ ] `posting_month` ที่ไม่อยู่ fiscal year ได้ `400 INVALID_QUERY`
- [ ] Pagination, sort allowlist และ tie-breaker ให้ผลลัพธ์คงที่ ไม่ซ้ำ/ข้ามรายการข้ามหน้า
- [ ] Amount decimal, date ISO, id string, field nullable แสดงตาม schema ไม่เปลี่ยน type ตาม record
- [ ] Aggregates เท่ากับการรวม transaction ชุด filter เดียวกัน รวม debit/credit/net และ monthly totals
- [ ] Selector คืน object value/label, limit และ q ทำงาน, ไม่มี parallel array หรือ duplicate
- [ ] 401/403/404/429/500 envelope และ request_id ตาม contract โดยไม่รั่วข้อมูล
- [ ] Endpoint legacy ยังผ่าน regression test ระหว่าง migration

## 12. ข้อตัดสินใจจาก Backend/Data owner ที่ต้องตอบก่อนเริ่ม

1. `fiscal_year` ครอบคลุมช่วงเดือนใด และข้อมูลปี 2026 ที่มีอยู่สิ้นสุดวันใด
2. ความหมายทางบัญชีของ amount บวก/ลบ และคำที่ผู้ใช้ต้องเห็นแทน `เบิกจ่าย` / `ไม่เบิกจ่าย`
3. `account_code` กับ `cost_center` ในฐานเดิมเป็น field เดียวกันหรือคนละ field; หากคนละ field ให้ระบุ mapping ของ endpoint เดิม
4. Budget/transaction เป็นข้อมูล public ตามหน้าปัจจุบันหรือจำกัดตาม role/สำนักงาน/หน่วยงาน
5. `username`, description และเลขเอกสาร ส่งให้ผู้ใช้ทุก role ได้หรือจำเป็นต้อง redact
6. สเกลข้อมูลสูงสุดต่อปี, database/index ที่มีอยู่, รอบ import และความสดข้อมูลที่สัญญาได้ เพื่อยืนยัน target latency/cache

