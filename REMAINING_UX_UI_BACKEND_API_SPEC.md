# Backend API — รองรับแผนปรับปรุงหน้าที่เหลือ

วันที่: 27 กันยายน 2026 · สถานะ: ข้อเสนอส่งต่อ backend ยังไม่ได้เพิ่ม API

อ้างอิง [แผน UX/UI หน้าที่เหลือ](REMAINING_UX_UI_IMPROVEMENT_PLAN.md), [สเปกงบประมาณเดิม](BUDGET_DASHBOARD_BACKEND_API_SPEC.md) และ [แผนฟอร์มอุปกรณ์ร่วม](COMPUTER_MANAGEMENT_SHARED_FORM_PLAN.md)

## 1. สรุปงานที่ขอ

| รหัส | ความสำคัญ | Endpoint | งาน |
|---|---|---|---|
| B1 | ต้องการรอบแรก | GET `/api/budgets/transactions` | เพิ่ม server-side global search `q` ก่อน pagination โดยคง filter/sort เดิม |
| B2 | ต้องการพร้อม B1 | GET `/api/budgets/transactions/aggregates` | ใช้ q/predicate เดียวกับ B1 เพื่อยอดและกราฟตรงกับรายการ |
| B3 | ต้องยืนยัน | GET `/api/budgets/transactions/selectors`, GET `/api/budgets/transactions/:id`, POST `/api/budgets/transactions/find` | ส่ง contract/field mapping และ regression results ไม่ต้องสร้างใหม่ |
| N1 | ยืนยัน/เติม field ที่ขาด | GET `/api/latency/metrics`, GET `/api/latency/down`, POST `/api/latency/check/:deviceId`, GET `/api/test/check-ip/:ip` | ความหมาย alive/status/เวลา/หน่วย/แหล่ง probe และ error |
| L1 | ยืนยันก่อนเสนอเพิ่ม | GET `/api/office-equipment/loans` | pagination เป็นรายชิ้นหรือราย batch และขอบเขตค้นหา |
| L2 | ทางเลือก | GET `/api/office-equipment/loan-batches/:batchId` | อ่านรายละเอียดทั้ง batch ถ้าต้องการเปิดดูทั้งชุดจากประวัติ |
| E1 | ทางเลือก ใช้แผนเดิม | GET `/api/pea-sites/:siteId/network-context` | แยกข้อมูลวงสำนักงาน หาก endpoint site เดิมไม่เพียงพอ |
| X1 | ทางเลือกภายหลัง | Export API | ขอเมื่อข้อมูลมากจน client export ไม่เหมาะสม ยังไม่กำหนดให้สร้างในรอบนี้ |

**รอบแรกขอขยาย2 endpointเดิมคือ B1/B2 ไม่จำเป็นต้องสร้าง endpointใหม่** ส่วน N1/L1 ขอคำตอบและตัวอย่างก่อน หากของเดิมครบอยู่แล้วให้ยืนยัน ไม่สร้างเส้นทางซ้ำ

งาน responsive, ตาราง, modal, focus, filled field, error/empty state และการคืนบริบทเป็นงาน frontend ไม่ต้องรอ APIใหม่

## 2. หลักฐานและสถานะล่าสุด

- ตรวจ GET `/api/budgets/transactions?page_size=10` และคำค้นสุ่ม `q=NE2_API_AUDIT_NO_MATCH_20260927_XYZ`: ทั้งคู่คืน total_items=6,178 ณ เวลาตรวจ จึงยังไม่สามารถถือว่า q ทำงานแล้ว
- API pagination มีอยู่แล้ว; page_size ยอมรับ10,15,25,50,100 และ page_size=1 คืน400 ไม่ขอเปลี่ยนข้อกำหนดนี้
- Frontend ล่าสุดมี BudgetTransactionsPanel และ deviceStatus.normalizeLiveStatus แล้ว แผน UX/UI ก่อนหน้าเป็น snapshot ก่อนการแก้เหล่านี้ อย่าถือว่าการแก้ frontend ดังกล่าวเป็นงานที่ backend ต้องทำ
- BudgetDashboard มี fallback ดาวน์โหลดทุกหน้าของชุดที่กรองแล้วมาค้นหา q ใน browser การเพิ่ม B1/B2 จะช่วยเลิก fallback นี้หลังผ่าน contract tests
- การทดสอบข้างต้นเป็น read-only ไม่ได้รัน scan, upload, ยืม/คืน หรือเปลี่ยนข้อมูลจริง

## 3. B1 — ค้นหาธุรกรรมครบทั้งชุด

### Endpoint และ compatibility

`GET /api/budgets/transactions`

คง envelope เดิม `success`, `data` array, `pagination`, `meta` และ fields เดิมทั้งหมด ไม่เปลี่ยนเป็น data.items โดยไม่มี version migration

queryเดิมที่ต้องรักษา: fiscal_year, account_code, deprecated cost_center alias, clearing_account_name, username, reference_doc_no, description, posting_month, amount_direction, date_from/date_to ตาม contract ปัจจุบัน, page, page_size, sort, order

`fiscal_year` ในระบบนี้คือปีปฏิทิน ม.ค.–ธ.ค.; account_code=cost_center ตาม schemaเดิม; amountบวก=debit, ลบ=credit, netรวมเครื่องหมาย ห้ามเปลี่ยนนิยามพร้อมงานค้นหา

### Query ใหม่/ขยาย

| Parameter | Contract |
|---|---|
| q | optional string, trim หัวท้าย; ว่างเท่ากับไม่กรอง; สูงสุด200 Unicode code points |
| page | integerเริ่ม1 ตามเดิม |
| page_size | 10/15/25/50/100 ตามเดิม |
| sort/order | whitelistเดิม; ต้องทำที่serverก่อน LIMIT/OFFSET |

q เป็น **literal substring ไม่แยกตัวพิมพ์** ใช้ข้อความทั้งก้อน ไม่แยกเป็นหลายคำหรือ regex; `%`, `_`, backslash เป็นตัวอักษรจริง ไม่ใช่ wildcard ผู้ใช้ต้องไม่ต้อง escape เอง

ค้นหา OR ข้าม fields: transaction_id, reference_doc_no, description, account_code, account_name, cost_center_name, clearing_account_code, clearing_account_name, username, fiscal_year, document_date, posting_date, posting_month, amount, amount_direction, currency ส่วน cost_center เป็น aliasของaccount_code ไม่ต้อง joinซ้ำ

กติกา field ที่ไม่ใช่ข้อความ:

- IDs/year เป็นเลขฐาน10แบบไม่มีseparator; วันที่ใช้ ISO YYYY-MM-DD, เดือน YYYY-MM
- amountใช้ canonical decimal เช่น `-1200.50` ไม่มีcomma/สัญลักษณ์บาท ไม่ค้นหาด้วยตัวเลขเงินที่ format ตามlocale
- nullไม่เท่ากับข้อความ `null` หรือ — และไม่เข้าผลค้นหาเพียงเพราะfieldหาย
- ไม่ค้นหา linked_job_count หรือ metadata/pagination; ไม่ค้นข้อมูลที่ไม่อยู่ในสิทธิ์การอ่านเดิม
- ถ้า fieldใดไม่มีจริง ให้แจ้ง mapping/ข้อจำกัดก่อนเปลี่ยนรายการ field ห้ามรับqแล้วค้นเพียงบางหน้าโดยเงียบ ๆ

นำ q AND กับ filtersรายfieldเดิม: เช่น q="สาย" + account_code="53032080" ต้องผ่านทั้งสองเงื่อนไข ไม่ให้ qล้าง account filter

SQLต้อง filterก่อน count/sort/page; amount sortเป็นdecimal ไม่ใช่string; sort keyซ้ำใช้ transaction_idเป็นtie-breakคงที่และ null orderที่ระบุชัด การเลือกหน้าต้องไม่เกิดซ้ำ/หายในข้อมูลคงที่

### ตัวอย่าง request/response

```text
GET /api/budgets/transactions?fiscal_year=2026&q=สาย&page=1&page_size=15&sort=amount&order=desc
```

ตัวอย่างสมมติจากชุดข้อมูลทดสอบ ไม่ใช่ข้อมูลproduction:

```json
{
  "success": true,
  "data": [{
    "transaction_id": "101",
    "fiscal_year": 2026,
    "document_date": "2026-09-01",
    "posting_date": "2026-09-02",
    "posting_month": "2026-09",
    "reference_doc_no": "DOC-001",
    "description": "ซื้อสายเครือข่าย",
    "account_code": "53032080",
    "account_name": "บัญชีตัวอย่าง",
    "cost_center": "53032080",
    "cost_center_name": null,
    "clearing_account_code": null,
    "clearing_account_name": null,
    "username": "example",
    "amount": "1200.50",
    "amount_direction": "debit",
    "currency": "THB",
    "linked_job_count": 0
  }],
  "pagination": { "page": 1, "page_size": 15, "total_items": 1, "total_pages": 1 },
  "meta": {
    "applied_filters": { "fiscal_year": 2026, "q": "สาย" },
    "search": { "version": "literal-v1", "scope": "all_filtered_records" }
  }
}
```

meta ตัวอย่างแสดงเฉพาะส่วนที่เกี่ยวข้อง ให้คงmetaเดิมทั้งหมด รวม deprecations/generated_at และส่ง applied_filtersครบที่ใช้จริง; meta.search เพิ่มแบบ backward-compatible เพื่อยืนยัน semantics ไม่ใช่ให้frontendเดาว่า deployแล้วจาก HTTP200

คำค้นไม่พบคืน200 success/data=[]/total_items=0/total_pages=0; หน้าที่เกินขอบคืน[]พร้อมtotalจริง ไม่แปลง failureเป็นempty success

## 4. B2 — ยอดรวมและกราฟตามคำค้นเดียวกัน

`GET /api/budgets/transactions/aggregates`

รับ qและ filtersชุดเดียวกับB1 โดยใช้ shared query builder/predicateเดียวกัน ไม่รับpage/page_sizeเพื่อคำนวณยอดจากหน้าเดียว คง validationและshapeเดิมของtotals/by_month/coverage

```text
GET /api/budgets/transactions/aggregates?fiscal_year=2026&q=สาย
```

ต้องรับประกันสำหรับชุดข้อมูลคงที่/filterเดียวกัน:

```text
transactions.pagination.total_items = aggregates.data.totals.transaction_count
SUM(amount ทุกหน้า) = aggregates.data.totals.net
totals.net = totals.debit + totals.credit
```

debitเป็นบวก creditเป็นลบ ไม่ใช้absเครดิต; จำนวนเงินเป็นdecimal string2ตำแหน่ง ห้ามแปลงผ่าน floating point แล้วปัดยอดผิด

เมื่อมี fiscal_yearคงครบ12เดือนตามAPIเดิมและนิยามempty-yearเดิม; qไม่พบต้องได้ยอด0และmonthlyตามกติกาเดิม ไม่ fallbackไปยอดทั้งปี ทุก bucketต้องใช้qเดียวกัน

รายการไม่มีposting_dateยังรวมtotals แต่แยกไว้ในcoverageตามcontractเดิม ดังนั้น sum monthly.net อาจไม่เท่าtotals.netเมื่อมีรายการไม่ทราบเดือน ต้องเพิ่ม/ยืนยัน `coverage.amount_without_posting_date` (decimal string) หากต้องการตรวจยอดได้ครบ:

```text
SUM(by_month.net) + coverage.amount_without_posting_date = totals.net
SUM(by_month.transaction_count) + coverage.records_without_posting_date = totals.transaction_count
```

เพิ่ม meta.search/applied_filtersเช่นB1 เก็บ semanticsว่าง/null/ยอดเงินให้ตรงกัน

**ข้อมูลเปลี่ยนระหว่างrequest:** ไม่รับประกันsnapshotข้ามendpointด้วยtimestampอย่างเดียว รอบแรกไม่ขอสร้าง snapshot systemใหม่สำหรับงบ ให้ระบุ consistency model และทดสอบ invariantบนfixtureที่ไม่เปลี่ยน หากต้องรับประกันระหว่างการนำเข้า/แก้ไขพร้อมกัน ให้เสนอ dataset revision/token หรือ responseรวมจากtransactionเดียวเป็นงานแยกก่อนพัฒนา ห้ามส่ง tokenสมมติที่ไม่ได้ตรึงข้อมูล

## 5. B3 — ยืนยัน mapping และผู้เรียกเดิม

| Consumer เดิม | Canonical fieldที่ต้องยืนยัน |
|---|---|
| id | transaction_id |
| year | fiscal_year (ปีปฏิทิน) |
| value_co_curr | amount (decimal, signเดิม) |
| cost_center | account_code (aliasเดิม) |
| clearing_account | clearing_account_code |
| count และfieldนำเข้าเฉพาะ | แจ้งว่ามีข้อมูลต้นทางหรือไม่ ไม่สร้างค่า0ปลอม |

ไม่ต้องเพิ่มaliasทุกตัวในทุกresponse: ส่งmappingจริงให้frontend adapterใช้; endpoint POST `/transactions/find` ที่ BudgetTransactionPicker/งานเชื่อมธุรกรรมใช้ต้องคงshapeเดิมจนย้ายcallerครบ

ส่งตัวอย่าง `GET /transactions/:id` ทั้งพบ/404 และ selectorsทั้ง legacy (ไม่ส่งfield) / `field=...&q=...&limit=...`; qของselectorคือค้นตัวเลือก ไม่ใช่qธุรกรรม ต้องอธิบายแยก ห้ามเปลี่ยนให้parameterชื่อเดียวกันมีผลต่างโดยไม่ระบุ

ไม่ขอแก้ upload/CRUDงบหรือ linked_jobs schemaในงานนี้ linked_job_count=0ที่backendเดิมแจ้งว่าไม่รองรับต้องยังไม่ถูกแสดงเป็นหลักฐานว่าไม่มีงานจริง

## 6. N1 — สถานะอุปกรณ์และเวลา: ยืนยันก่อนเพิ่ม

Frontend เริ่มแก้normalizeเป็นonline/offline/unknownแล้ว จึง **ไม่ต้องสร้าง endpointใหม่เพื่อแก้undefined!==null** ต้องการcontractที่ชัดของsourceเดิมเพื่อไม่ให้เกิดความคลาดเคลื่อนอีก

| Endpointเดิม | คำตอบที่ขอ |
|---|---|
| GET `/api/latency/metrics` | แต่ละรายการอ้าง device_idหรือid, มีalive/statusอะไรบ้าง, timestampใดคือเวลาวัดจริง |
| GET `/api/latency/down` | เป็นผลวัดล่าสุดของแต่ละdeviceหรือมีประวัติปน, มีcutoffความสดหรือไม่, รายการเก่าที่ไม่ตรวจนานยังนับdownอย่างไร |
| POST `/api/latency/check/:deviceId` | ตอบผลทันทีหรือรับงานasync, shape/time/error, การเช็คนี้เปลี่ยนข้อมูลmonitoringอะไรบ้าง |
| GET `/api/test/check-ip/:ip` | sourceของprobe, alive/null semantics, latency/packet lossหน่วยและchecked_at |

หากfieldขาดเสนอเติมแบบadditive โดยไม่ลบalive/status/latency aliasเดิม:

```json
{
  "device_id": "123",
  "alive": null,
  "status": "unknown",
  "latency_ms": null,
  "packet_loss": null,
  "checked_at": null,
  "probe_source": "backend",
  "error_code": "NO_MEASUREMENT"
}
```

ตัวอย่างเป็นdataหนึ่งรายการ ไม่ใช่การบังคับเปลี่ยนenvelopeของทุกendpoint

- alive=true/falseเฉพาะผลที่วัดได้จริง; ไม่ทราบเป็นnull, ค่าlatency0หรือpacket_loss0เป็นค่าที่มีความหมาย ไม่ใช้truthiness
- statusที่เสนอ up/down/unknown ต้องmapจากenumเดิมและระบุprecedence; หากalive/statusขัดกันให้แจ้งdata qualityหรือunknown ไม่คืนข้อมูลขัดแย้งแล้วให้frontendเดา
- checked_atเป็นISO8601พร้อมoffset/UTCจากเวลาวัด ไม่ใช่เวลาที่ผู้ใช้เปิดหน้า/GET API; เวลาserverสร้างresponseให้เป็นmeta.generated_atแยก
- latency_ms≥0หรือnull, packet_loss0–100หรือnull; failureของAPIไม่เท่ากับhostไม่ตอบสนอง
- ถ้ามีfreshness/stale thresholdจริงให้ส่ง threshold/sourceในmeta หากไม่มีให้บอกว่าไม่ทราบ ไม่กำหนดthresholdเองเพื่อให้ทุกเครื่องดูปกติ
- GET `/latency/down` ว่างหลังqueryสำเร็จต้องต่างจาก503; คงค่ารายการเก่าได้เฉพาะพร้อมข้อมูลว่าเป็นผลวัดครั้งก่อน ไม่ส่ง200[]เพื่อกลบdatabase error
- ไม่รันscan/เปลี่ยนschedulerหรือnotificationในงานdocument/contract verification ใช้fixturesหรือผลที่มีอยู่ทดสอบ

## 7. L1/L2 — ประวัติยืมแบบbatch

### L1 สิ่งที่ต้องยืนยันของ APIเดิม

`GET /api/office-equipment/loans?page=1&limit=20&status=open&pea_site_id=...&search=...`

- page/limitนับloan rowsหรือbatch, sort/tie-breakและจำนวนtotal/totalPagesหมายถึงอะไร
- batch_idมีทุกloanหรือไม่ และbatchอาจข้ามหน้าหรือไม่ (frontendปัจจุบันรวมกลุ่มเฉพาะrowsในหน้านั้น)
- searchค้นทุกrowก่อนแบ่งหน้าและครอบคลุมfieldsใด คงสิทธิ์อ่าน/คืนเดิม
- returned_at/timezone, equipmentถูกลบ, borrow/return errorsและสิทธิ์ที่แสดงในUI

หากยอมรับแสดงบางส่วนของbatchพร้อมคำอธิบายในUI **ไม่ต้องสร้างL2**

### L2 ทางเลือกเมื่อผู้ใช้ต้องเปิดดูทั้งbatch

`GET /api/office-equipment/loan-batches/:batchId?page=1&limit=1`

```json
{
  "success": true,
  "data": {
    "batch_id": "example-batch",
    "summary": { "total_items": 2, "open_items": 1, "returned_items": 1 },
    "items": [
      { "loan_id": "11", "equipment_id": "501", "equipment_name": "อุปกรณ์ตัวอย่าง", "borrowed_at": "2026-09-01T02:00:00Z", "returned_at": null }
    ]
  },
  "pagination": { "page": 1, "limit": 1, "total": 2, "totalPages": 2 }
}
```

ตัวอย่างใช้ limit=1 จึงคืน items 1 รายการจากทั้งหมด 2 รายการ และ totalPages=2; หาก limit=20 ต้องคืนครบ 2 รายการและ totalPages=1 โดยคำนวณจำนวนหน้าจาก ceil(total/limit)

batchIdเป็นopaque ID validateตามschemaจริง ไม่สมมติว่าเป็นinteger; summaryนับทั้งbatchภายใต้สิทธิ์ ไม่ใช่เฉพาะpage; fieldผู้ยืม/สำนักงานเพิ่มได้เฉพาะที่APIเดิมอนุญาต ไม่ขยายการเปิดเผยข้อมูล

404เมื่อไม่พบตามpolicyเดิม, 401/403ตามauthจริง; endpointนี้อ่านอย่างเดียว **ไม่เพิ่มคืนทั้งbatch** และไม่ย้ายสิทธิ์การคืนไปfrontend

## 8. E1 และ X1 — ยังไม่ต้องทำในรอบแรก

E1 `GET /api/pea-sites/:siteId/network-context` ใช้ข้อเสนอใน COMPUTER_MANAGEMENT_SHARED_FORM_PLAN.md เมื่อการอ่าน network_ip ผ่าน `/api/office-equipment/site/:siteId` ไม่เหมาะสมจริง ต้องยืนยันของเดิมก่อน ไม่ต้องทำซ้ำหากมีเส้นทางเทียบเท่า

IP allocation policyและIP reservationเป็นคนละเรื่อง ข้อเสนอE1ไม่ให้รับรองว่าIPว่างหรือจองแล้ว

X1 exportฝั่งserverพิจารณาเมื่อปริมาณข้อมูลจำเป็น ต้องตกลงresource, format, scopeทั้งชุด/ผลกรอง/ที่เลือก, limits, authและอายุไฟล์ก่อนกำหนดendpoint ไม่ขอสร้างexportทั่วไปครอบคลุมทุกresourceโดยยังไม่ทราบrequirements

## 9. Error, authorization และ compatibility

- คงauth/public/rolesของแต่ละAPIเดิม งานUX/UIไม่ใช่การอนุญาตให้เปิดข้อมูลหรือwriteโดยไม่login
- ใช้HTTP400พร้อมโครงสร้างerrorเดิมสำหรับqยาวเกิน, sort/filter/date/pageผิด; emptyqไม่error
- ตัวอย่างerrorที่คงรูปแบบbudgetsเดิม:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "q must not exceed 200 characters",
    "fields": { "q": "Too long" }
  },
  "request_id": "example-request"
}
```

- ไม่ใส่stack trace/queryภายใน/credentialsในerror; ไม่ส่งsuccess:trueเมื่อvalidation/queryล้มเหลว
- เพิ่มqด้วยbound parametersและliteral escaping ห้ามต่อSQLจากq/sortตรง ๆ; sortใช้whitelist
- ไม่เปลี่ยนpagination defaults/page sizesเดิม ไม่ลบdeprecated aliasหรือlegacy selectors/find/summary routesจากงานนี้
- หากต้องเปลี่ยนshape/semanticsเดิมแบบbreakingให้เสนอversionแยกก่อน ไม่บังคับfrontendทุกหน้าปรับพร้อมกันโดยไม่แจ้ง

## 10. Contract tests ที่ขอให้ส่งผลกลับ

1. B1คำค้นสุ่มไม่พบคืนtotal0; empty/whitespaceqเหมือนไม่ส่งq และข้อมูลจำนวน0เป็นsuccessที่ถูกต้อง
2. คำไทย/อังกฤษcaseต่างกัน/%/_/backslash/null/จำนวนเงินลบ/วันที่ทำงานตามliteral-v1 ที่นิยาม ไม่เกิดSQL wildcardหรือค้นค่าnullปลอม
3. qร่วมปี/บัญชี/เดือน/ผู้ใช้/ทิศทางเป็นAND และค้นครอบคลุมrecordนอกหน้าแรก
4. ไล่ทุกหน้าบนfixtureคงที่แล้วไม่ซ้ำ/หาย; sortamountเป็นnumeric, tie-breakคงที่, pageเกินขอบให้emptyพร้อมtotalจริง
5. B1total=B2count และผลรวมamountทุกหน้า=B2net; debit+credit=net ตรวจด้วยdecimal
6. มีรายการposting_date=nullแล้วcoverageจำนวน/เงินอธิบายส่วนต่างของmonthlyกับtotalsได้; ไม่มีการตัดรายการทิ้งจากtotals
7. B2ใช้qเดียวกันทุกbucket ไม่คืนยอดทั้งปีเมื่อรายการถูกกรอง; เดือน/ปีว่างคงcontractเดิม
8. validateq200/201Unicode code points, invalidpage_size/sort/dates; responseerrorไม่เป็นempty success
9. regression: budget summary, selectorsทั้งสองโหมด, transaction detail, POSTfind, uploadและCRUDเดิมไม่เปลี่ยนshape/สิทธิ์
10. N1ข้อมูลไม่มี/เก่า/APIล้มเหลว/latency0/packet_loss0/100และalive=false ไม่ถูกแปลงเป็นonlineหรือ0แทนunknown; เวลาเป็นเวลาวัดจริง
11. ถ้าทำL2: batchข้ามหน้า/itemsที่ลบ/สิทธิ์/totalตรงกับsummary และไม่มีwriteเกิดจากGET
12. ส่งperformanceที่วัดกับdatasetทดสอบใกล้เคียงจริง ทั้งqแคบ/qกว้างและcount+aggregates; ระบุขนาดข้อมูลและเวลา ไม่รับรองperformanceด้วยจำนวนrowน้อยอย่างเดียว

## 11. สิ่งที่ backend ส่งกลับก่อนเชื่อม frontend

- B1/B2รองรับครบหรือส่วนใดทำไม่ได้ พร้อมfield mappingจริงและตัวอย่างsuccess/empty/error
- migration/deploymentที่ต้องทำหรือยืนยันว่าไม่ต้องทำ และenvironmentที่ทดสอบแล้ว
- ผลcontract testsและข้อจำกัดconsistencyระหว่างรายการกับaggregateขณะข้อมูลเปลี่ยน
- N1นิยามstatus/time/source และfieldsที่มีอยู่แล้ว/ต้องเพิ่ม
- L1pagination/batch semantics; ยืนยันว่าจะทำL2หรือให้UIแสดงbatchบางส่วนตามหน้า
- meta.search/versionที่ใช้ยืนยันความสามารถหรือวันที่deployที่ชัดเจน ก่อนfrontendเลิกfallbackค้นทุกหน้า

ลำดับแนะนำ: B1+B2 → ยืนยันB3/N1/L1 → frontendเชื่อมและregression → ตัดสินใจE1/L2/X1เฉพาะที่ต้องใช้จริง
