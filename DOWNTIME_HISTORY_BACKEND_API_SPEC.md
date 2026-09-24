# Backend API Specification — ประวัติการขัดข้อง

วันที่: 24 กันยายน 2026 · ผู้ใช้งาน: หน้า `/downtime-history` ของ NE2 LDAP

เอกสารส่งต่อ backend ตาม [แผนปรับปรุงหน้า](DOWNTIME_HISTORY_IMPROVEMENT_PLAN.md) สเปกนี้เป็นข้อเสนอเพื่อพัฒนา ยังไม่ได้ยืนยันกับ schema หรือ API สด หากทำบางส่วนไม่ได้ให้แจ้งข้อจำกัดตามหัวข้อ 13 ก่อนเปลี่ยน contract

## 1. งานที่ต้องส่งมอบ

| งาน | Endpoint | ขอบเขต |
|---|---|---|
| เพิ่ม | `GET /api/devices/downtime/incidents` | รายการ ค้นหา ตัวกรอง sort และ server pagination |
| ขยาย | `GET /api/devices/downtime/summary?contract=v2` | สรุปตามตัวกรอง พร้อม snapshot สำหรับใช้ร่วมกัน |
| ขยาย | `GET /api/devices/downtime/dashboard?contract=v2` | กราฟรายวัน/เดือนและอันดับภายใต้ snapshot/filter เดียวกัน |
| เพิ่มหรือใช้ของเดิมที่เทียบเท่า | `GET /api/devices/downtime/selectors` | ปีและจังหวัดจากข้อมูลทั้งหมดที่ผู้ใช้มีสิทธิ์ |

`contract=v2` เป็นวิธีแยก response ใหม่ของสองเส้นทางเดิม เมื่อไม่ส่งต้องตอบ shape/ความหมายเดิมทุกอย่าง หาก backend มีนโยบาย version ผ่าน path ให้แจ้ง mapping ก่อนเริ่ม frontend ไม่รองรับหลายรูปแบบแบบคาดเดา

คง `/all`, summary/dashboard แบบเดิม และ `/api/devices/:id/downtime` ไว้ ไม่เปลี่ยน authorization เดิม เอกสารนี้ไม่อนุญาตให้เปิดข้อมูล public เพิ่ม และไม่บังคับ login เพิ่มโดยไม่มีการตกลง

ยังไม่ต้องทำ export, SLA/uptime%, MTTR หรือ incident detail endpoint ใหม่

## 2. Query สำหรับ incidents / summary v2 / dashboard v2

| Parameter | ชนิด / ค่าเริ่มต้น | กติกา |
|---|---|---|
| `date_from` | ISO8601 มี timezone, required | รวมจุดเริ่มต้น |
| `date_to_exclusive` | ISO8601 มี timezone, required | ไม่รวมจุดสิ้นสุด; ต้องมากกว่า date_from |
| `timezone` | `Asia/Bangkok` | รอบแรกยอมรับเฉพาะค่านี้ ใช้แบ่งวัน/เดือน |
| `match` | `overlap` หรือ `started`; default overlap | ตามนิยามส่วน 3 |
| `q` | string, trim, สูงสุด 200 ตัวอักษร | contains แบบไม่แยกตัวพิมพ์ในชื่อสำนักงาน ชื่ออุปกรณ์ IP; ไม่แปล wildcard เป็น SQL pattern |
| `province` | string หรือไม่ส่ง | exact match; ค่าว่างเท่ากับไม่กรอง ไม่ส่งคำว่า All/ทั้งหมด |
| `device_id` | string ของ ID จริง หรือไม่ส่ง | validate ตามชนิด PK ของ backend; ไม่อนุมาน ID จากชื่อสำนักงาน |
| `status` | `open`, `resolved`, `unknown` หรือไม่ส่ง | สถานะเหตุการณ์ ณ snapshot ไม่ใช่สถานะสดของอุปกรณ์ |
| `snapshot_token` | opaque string หรือไม่ส่ง | ตามส่วน 4 |

ช่วงเวลาสูงสุด 366 วันต่อคำขอ เพื่อแสดงทั้งปีอธิกสุรทินได้; ปีใช้ ค.ศ. Frontend แปลงปีเป็นวันที่เอง ไม่รับ `year` ใน contract v2 เพื่อไม่ให้ขัดกับวันที่

ตัวอย่างเลือกเดือนมกราคมตามเวลาไทย:

```text
date_from=2026-01-01T00:00:00%2B07:00&date_to_exclusive=2026-02-01T00:00:00%2B07:00
```

`+` ต้อง URL encode เป็น `%2B` หรือใช้ URLSearchParams ห้าม backend รับวันที่ไม่มี timezone แล้วเดาเขตเวลาเอง

คำค้นและทุกตัวกรองต้องครอบคลุมข้อมูลทั้งหมดก่อน pagination และใช้ชุด predicate เดียวกันข้าม endpoint

## 3. นิยามการนับและระยะเวลา

### 3.1 ชุดข้อมูลและสถานะ

- 1 incident = 1 เหตุการณ์ตาม ID ต้นฉบับ ไม่รวมหลายเหตุการณ์ของอุปกรณ์เดียวเป็นรายการเดียว
- `open`: backend ยืนยันว่าเหตุการณ์ยังไม่จบ; `resolved`: ยืนยันว่าจบแล้วพร้อม up_at ที่ถูกต้อง; `unknown`: สถานะ/ข้อมูลไม่พอยืนยันหรือขัดแย้งกัน ต้อง map จาก schema จริงก่อนส่งมอบ
- `up_at=null` อย่างเดียวไม่พอจะบอก open หากข้อมูลเดิมมีความหมายอื่น เช่น ข้อมูลสูญหาย
- นับอุปกรณ์ด้วย stable device ID; record ที่ไม่มี device ID ยังนับ incident แต่ไม่นับ distinct device ให้มี `unlinked_incident_count` กำกับ
- record ที่ไม่มี down_at ที่ใช้ได้ ไม่สามารถจัดเข้า date filter: ไม่รวมในชุดผลและรายงาน `meta.data_quality.invalid_start_record_count` ภายใต้สิทธิ์และตัวกรองที่ไม่ใช่วันที่ ห้ามทิ้งเงียบ ๆ

### 3.2 การเลือกเหตุการณ์

กำหนด F=date_from, T=date_to_exclusive, A=as_of และ E=min(T,A) ไม่รับ F>A; T อยู่อนาคตได้เพื่อดูปีปัจจุบัน แต่ไม่สร้าง duration ในอนาคต

- `started`: F ≤ down_at < T และ down_at ≤ A รวมเหตุระยะเวลา 0 ได้
- `overlap`: down_at < E และ effective_end > F โดย effective_end=up_at สำหรับ resolved หรือ A สำหรับ open
- resolved ที่ down_at=up_at ให้เป็น point event: รวมเมื่อ F ≤ down_at < E แม้ duration=0
- unknown ที่ระบุช่วงสิ้นสุดไม่ได้: รวมแบบ overlap เฉพาะเมื่อ down_at อยู่ใน [F,E) พร้อม duration=null; ไม่สมมติว่ายัง down ตั้งแต่อดีตถึงปัจจุบัน
- down_at อนาคต/ up_at < down_at เป็นข้อมูลผิดปกติ ต้องรายงาน data_quality; เหตุที่เริ่มในช่วงและยังอธิบายได้อาจแสดง unknown พร้อม null duration โดยไม่รวม duration ติดลบ

ทั้ง count, top_devices และ buckets ต้องใช้ชุดผลที่ผ่าน filters/match เดียวกัน

### 3.3 ระยะเวลา

สำหรับ record ที่ช่วงเวลาถูกต้อง:

```text
end = min(up_at, A) สำหรับ resolved; A สำหรับ open
duration_ms = max(0, end - down_at)
duration_in_range_ms = max(0, min(end, T) - max(down_at, F))
```

unknown ที่ไม่มี end ที่เชื่อถือได้คืน null ทั้งสองค่า; ระยะเวลาทั้งหมดเป็น integer milliseconds ไม่ใช่ string formatted ไม่เอา null ไปแทน 0

`total_duration_in_range_ms` รวมเฉพาะค่าที่คำนวณได้ พร้อม `duration_unknown_count` และ `duration_is_complete` (true เมื่อไม่มี duration ที่ไม่ทราบ) ยอด 0 ที่ completeness=false ไม่ได้หมายความว่าไม่มีการขัดข้อง

เวลาสะสมเป็น **ผลรวมรายเหตุการณ์ของอุปกรณ์** จึงอาจมากกว่าจำนวนชั่วโมงปฏิทิน ไม่ใช่เวลาที่ทั้งองค์กรใช้งานไม่ได้ หากต้นทางมีเหตุซ้อนกันในเครื่องเดียวให้แจ้งไว้ ไม่เปลี่ยนเป็น union duration โดยเงียบ ๆ

### 3.4 จำนวนในกราฟและ drill-down

- `matched_incident_count`: จำนวนรายการในชุดผล
- `started_incident_count`: จำนวนในชุดผลที่เริ่มใน [F,T) และไม่เกิน A
- `affected_device_count`: distinct device ID ในชุดผล
- `open_incident_count`: จำนวน open ในชุดผล; `open_device_count`: distinct device ID ของ open ในชุดผล
- กราฟใช้ `started_incident_count` ต่อวัน/เดือน ผลรวมจึงอาจไม่เท่า matched_incident_count ของ overlap
- เมื่อคลิกจำนวนเหตุของเดือน/วัน ส่ง match=started และช่วงเวลาของ bucket ที่ตัดด้วยช่วง filter เดิม พร้อม q/province/device/status เดิมและ snapshot เดิม จะได้ pagination.total_items ตรงกับค่าที่กด
- duration ต่อ bucket เป็นส่วนของช่วงขัดข้องที่ทับ bucket ไม่เอาระยะเวลาทั้งเหตุไปกองในวันที่เริ่ม ผลรวม daily และ monthly ต้องเท่ากับ summary duration ภายใต้เงื่อนไขเดียวกัน

## 4. Snapshot และความสอดคล้อง

Timestamp เดียวกันอย่างเดียวไม่พอ เพราะ record เก่าอาจถูกแก้ระหว่าง requests ต้องตรึง record version/ชุดผลจริงด้วย MVCC, materialized snapshot/cache หรือกลไกเทียบเท่า

1. Frontend เรียก summary v2 โดยไม่ส่ง token เพื่อสร้าง snapshot จากข้อมูลที่ผู้ใช้มีสิทธิ์
2. Response คืน snapshot_token, as_of และ snapshot_expires_at อายุเสนอ 10 นาที
3. Frontend ส่ง token เดิมไป incidents/dashboard และเปลี่ยน page/sort/drill-down ได้ ข้อมูลและสถานะต้องมาจาก snapshot เดิม; หาก cache เฉพาะ filter ผลลัพธ์ต้องยังรองรับ drill-down เป็น subset ภายใน snapshot ได้
4. เรียก incidents/dashboard โดยไม่มี token ได้ ให้สร้าง snapshot และคืน meta รูปแบบเดียวกัน แต่การเรียกแยกโดยไม่แชร์ token ไม่รับประกันยอดตรงกัน
5. token ผูกกับขอบเขตสิทธิ์ ห้ามใช้ข้ามบัญชี/ข้ามสิทธิ์ หากสิทธิ์เปลี่ยนให้ปฏิเสธหรือหมดอายุ ไม่คืนข้อมูล cache ที่ไม่มีสิทธิ์แล้ว
6. หมดอายุคืน 410 SNAPSHOT_EXPIRED; frontend จะ refresh ทั้งชุด ไม่ผสมข้อมูลต่าง snapshot

หากกลไกนี้หนักเกินไป ให้ backend เสนอ response รวม summary/dashboard/รายการหน้าแรกจาก transaction เดียวพร้อมแนวทาง pagination/drill-down ที่คง consistency ก่อน implement ห้ามอ้างว่า snapshot รองรับแล้วด้วยการส่ง timestamp อย่างเดียว

## 5. รูปแบบ response ร่วม

```json
{
  "success": true,
  "data": {},
  "meta": {
    "contract_version": "v2",
    "snapshot_token": "opaque-token",
    "as_of": "2026-09-24T03:00:00Z",
    "snapshot_expires_at": "2026-09-24T03:10:00Z",
    "data_updated_at": null,
    "timezone": "Asia/Bangkok",
    "applied_filters": {
      "date_from": "2026-01-01T00:00:00+07:00",
      "date_to_exclusive": "2027-01-01T00:00:00+07:00",
      "match": "overlap",
      "q": null,
      "province": null,
      "device_id": null,
      "status": null
    },
    "coverage": {
      "status": "unknown",
      "known_from": null,
      "known_to_exclusive": null,
      "gaps": []
    },
    "data_quality": {
      "invalid_start_record_count": 0,
      "invalid_interval_record_count": 0
    }
  }
}
```

`data_updated_at` = เวลาที่ระบบรับ/อัปเดตแหล่งข้อมูลล่าสุด ไม่ใช่เวลาเริ่ม incident ล่าสุด; ไม่มีหลักฐานให้ null `coverage.status=complete|partial|unknown` ต้องอ้างอิงช่วงที่มีการเฝ้าระวังจริง ไม่สรุป coverage จาก min/max ของ incident เพราะช่วงไร้เหตุอาจเฝ้าระวังครบก็ได้

timestamps ที่ส่งกลับใช้ ISO8601 พร้อม timezone; IDs ส่งเป็น string สม่ำเสมอเพื่อไม่สูญเสีย precision สำหรับ bigint; จำนวนและ milliseconds ส่งเป็น JSON number ที่อยู่ใน safe integer range

ตัวอย่างต่อไปนี้แสดงเฉพาะ data; ทุก endpoint ยกเว้น selectors ต้องมี meta ตามด้านบน

## 6. GET /api/devices/downtime/incidents

Query เพิ่มเติม:

| Parameter | Default | กติกา |
|---|---|---|
| page | 1 | integer ≥1 |
| page_size | 15 | integer 1–100 |
| sort_by | down_at | down_at, up_at, duration_ms, province |
| sort_order | desc | asc, desc |

sort ค่า duration เป็นตัวเลข; null อยู่ท้ายเสมอ ทั้ง asc/desc; ใช้ incident_id ASC เป็น tie-break คงที่ ระบุวิธีเรียง ID ตาม PK ไม่พึ่ง order ไม่แน่นอนจาก DB

```json
{
  "items": [
    {
      "incident_id": "1001",
      "device_id": "123",
      "device_name": null,
      "pea_name": "สำนักงานตัวอย่าง",
      "gateway": "172.21.1.1",
      "province": "อุบลราชธานี",
      "down_at": "2026-01-02T01:00:00Z",
      "up_at": "2026-01-02T02:00:00Z",
      "status": "resolved",
      "duration_ms": 3600000,
      "duration_in_range_ms": 3600000
    }
  ],
  "pagination": { "page": 1, "page_size": 15, "total_items": 1, "total_pages": 1 },
  "sort": { "by": "down_at", "order": "desc" }
}
```

ข้อมูลตัวอย่างสมมติ ไม่ใช่ข้อมูล production; missing name/IP/province ให้ null ไม่ใช้ N/A record ที่ device ถูกลบยังอยู่ในประวัติได้ด้วย device_id=null และข้อมูลเก่าที่มีจริง

ไม่มีผล: items=[], total_items=0, total_pages=0, page คงค่าที่ขอ หน้าที่เกิน total_pages คืน items=[] พร้อม totals จริง ไม่ clamp เงียบ ๆ เพื่อให้ frontend ปรับหน้าและส่งใหม่เอง

## 7. GET /api/devices/downtime/summary?contract=v2

```json
{
  "matched_incident_count": 1,
  "started_incident_count": 1,
  "affected_device_count": 1,
  "open_incident_count": 0,
  "open_device_count": 0,
  "resolved_incident_count": 1,
  "unknown_incident_count": 0,
  "unlinked_incident_count": 0,
  "total_duration_in_range_ms": 3600000,
  "duration_unknown_count": 0,
  "duration_is_complete": true,
  "current_state": {
    "scope": "all_authorized_devices",
    "currently_offline_device_count": null,
    "observed_at": null
  }
}
```

current_state มีไว้รักษาความสามารถการ์ด “กำลังขัดข้อง” เดิม: ใช้ source เดิมที่ยืนยันนิยามแล้ว distinct devices ในสิทธิ์ทั้งหมด ณ snapshot ไม่ใช้ filter ประวัติ และต้องติดป้ายแยกใน UI หาก source นี้ไม่มีจริงให้ null ไม่อนุมานจากเหตุการณ์เก่าทั้งหมดหรือคืน0

matched = open + resolved + unknown; ยอดรวมและ count เป็น0เมื่อไม่มีผล query ที่สำเร็จจริง ส่วนข้อมูล current_state ยังเป็นคนละ scope

## 8. GET /api/devices/downtime/dashboard?contract=v2

Query เพิ่ม `top_limit` default10, integer1–50 ไม่รับ page/page_size

data ประกอบด้วย:

| Field | รูปแบบ |
|---|---|
| totals | matched_incident_count, started_incident_count, total_duration_in_range_ms, duration_unknown_count; ตรงกับ summary |
| daily | array ของ bucket ทุกวันในช่วง |
| monthly | array ของ bucket ทุกเดือนในช่วง |
| top_devices | array ตามรูปแบบด้านล่าง สูงสุด top_limit |
| unlinked_incident_count | จำนวนในชุดผลที่ไม่มี device ID ไม่สร้างอันดับปลอมจากชื่อซ้ำ |

ตัวอย่าง bucket:

```json
{
  "period_start": "2026-01-02T00:00:00+07:00",
  "period_end_exclusive": "2026-01-03T00:00:00+07:00",
  "started_incident_count": 1,
  "duration_in_range_ms": 3600000,
  "coverage_status": "complete",
  "duration_is_complete": true
}
```

period เป็นขอบวัน/เดือนตาม timezone การคำนวณต้องตัดด้วย F/T/A; ส่ง bucket ครบทั้งช่วงรวมปีอธิกสุรทิน อนาคตทั้งหมดใช้ coverage_status=future และค่าทั้งสอง null ช่วง coverage complete ที่ไม่มีเหตุใช้0 ส่วน partial/unknown ส่งจำนวน/ระยะเวลาจาก record ที่มีจริงได้แต่กำกับ coverage ไม่ให้ frontend ตีความเป็นช่วงวัดครบ; ไม่มี record และไม่ทราบ coverage ใช้ null

ห้ามทิ้งค่าที่สังเกตได้จริงจาก bucket เพียงเพราะ coverage ไม่ครบ ผลรวมค่าตัวเลขที่มีต้องตรงกับ totals; completeness แยกจากจำนวนที่บันทึกไว้

ตัวอย่าง top device:

```json
{
  "rank": 1,
  "device_id": "123",
  "device_name": null,
  "pea_name": "สำนักงานตัวอย่าง",
  "gateway": "172.21.1.1",
  "province": "อุบลราชธานี",
  "incident_count": 1,
  "total_duration_in_range_ms": 3600000,
  "duration_unknown_count": 0
}
```

อันดับเรียง incident_count DESC → total_duration_in_range_ms DESC → device_id ASC; count เป็น matched incidents ของอุปกรณ์ภายใต้ match ปัจจุบัน ไม่ใช่จำนวนเริ่มเสมอ จึงต้องแสดงชื่อเกณฑ์ใน UI ไม่รวมอันดับ top10 ให้เป็นยอดทั้งระบบ

## 9. GET /api/devices/downtime/selectors

ไม่ใช้ date filter/page ของรายการ ใช้สิทธิ์เดียวกับ incidents คืนข้อมูลจากทั้งชุด ไม่ส่ง snapshot_token เพื่อใช้เปรียบเทียบยอดกับ API อื่น

```json
{
  "success": true,
  "data": {
    "available_years": [2026, 2025],
    "provinces": [
      { "value": "อุบลราชธานี", "label": "อุบลราชธานี" }
    ],
    "timezone": "Asia/Bangkok"
  }
}
```

ปีเป็น ค.ศ. เรียงล่าสุดก่อน ครอบคลุมปีที่ incident ทับช่วงรวม open incidents ถึงปีปัจจุบัน ไม่ใช่เฉพาะปีที่เริ่ม; provinces unique และเรียงภาษาไทย ข้อมูลว่างคืน [] Frontend ยังเลือกปีปัจจุบันและกรอกวันที่เองได้ หากมี selector กลางเทียบเท่าให้แจ้ง endpoint/shape แทนสร้างใหม่

## 10. Error และ validation

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "date_from ต้องน้อยกว่า date_to_exclusive",
    "fields": ["date_from", "date_to_exclusive"]
  }
}
```

| HTTP | code / สถานการณ์ |
|---|---|
| 400 | INVALID_QUERY, INVALID_DATE_RANGE, DATE_RANGE_TOO_LARGE, INVALID_TIMEZONE, INVALID_SORT, INVALID_SNAPSHOT |
| 401/403 | ตาม authentication/authorization เดิม; ห้ามแปลงเป็น empty success |
| 410 | SNAPSHOT_EXPIRED |
| 429 | RATE_LIMITED พร้อม Retry-After ถ้ามี rate limit |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE ไม่มี stack trace ใน response |

query ไม่รู้จัก/enum ผิดให้400 ใน contract ใหม่ ไม่ ignore filter เงียบ ๆ; device_id รูปแบบถูกแต่ไม่พบ/ไม่มีรายการที่ผู้ใช้มองเห็นให้200 empty ไม่เปิดเผยข้อมูลนอกสิทธิ์

API ใหม่ไม่รับ query `contract` ยกเว้นสองเส้นทางที่ขยาย; snapshots เป็น opaque identifiers ไม่ควรมี token auth ฝังอยู่

## 11. เกณฑ์ทดสอบที่ Backend ต้องส่งผลกลับ

1. **Consistency:** filter/snapshot เดียวกัน incidents.total_items = summary.matched = dashboard.totals.matched; totals duration ตรงกัน
2. **Filter จริง:** q สุ่มที่ไม่มีอยู่คืน0ทุกส่วน; q ชื่อไทย/IP, province, device_id, status และการผสม filter ทำงานจริง ไม่จำกัดแค่หน้าแรก
3. **ข้ามขอบช่วง:** เหตุเริ่มก่อน F แต่จบหลัง F อยู่ใน overlap ไม่อยู่ started; เวลาคิดเฉพาะส่วนทับช่วง
4. **ขอบเวลา:** จบตรง F ไม่รวม overlap; เริ่มตรง T ไม่รวม; duration0 ภายในช่วงยังนับเหตุ; ทดสอบ midnight เวลาไทยและ 29 ก.พ.
5. **Fixture คำนวณ:** F=2026-01-01 00:00+07, T=2026-01-02 00:00+07, A=2026-01-02 12:00+07 มี A เริ่ม31ธ.ค.23:00จบ1ม.ค.01:00, B เริ่ม1ม.ค.12:00จบ14:00, C เริ่ม1ม.ค.23:00ยังopen ต้องได้ overlap matched3, started2, durationในช่วง14,400,000ms; durationเต็มของ C=46,800,000ms
6. **Buckets:** sum started daily = sum started monthly = summary.started; sum duration buckets = summary.duration (นับเฉพาะค่าที่ทราบ) รวมเหตุข้ามเดือนและอนาคตที่ต้องไม่คิดเวลาเพิ่ม
7. **Drill-down:** คลิก count วัน/เดือนแล้ว match=started ของช่วงนั้นให้จำนวนรายการตรงกับกราฟ ภายใต้ snapshot/filter เดิม
8. **Pagination/sort:** sort duration เป็นตัวเลข; nullท้าย; tie-break คงที่; ไล่ทุกหน้าไม่ซ้ำ/หายภายใน snapshot; pageเกินขอบคืนemptyพร้อมtotalจริง
9. **Snapshot:** ระหว่างขอหน้า1/หน้า2/กราฟมี incident ใหม่หรือแก้ up_at ผล token เดิมไม่เปลี่ยน; tokenใหม่เห็นข้อมูลใหม่; หมดอายุ410; ข้ามสิทธิ์อ่านไม่ได้
10. **ข้อมูลผิดปกติ:** missing device/status/duration, bad dates, unknown, duration0 และ deviceถูกลบไม่ทำ500หรือกลายเป็นresolvedโดยอัตโนมัติ; quality/completeness ตรงจริง
11. **Coverage:** ข้อมูลว่างที่เฝ้าระวังครบต่างจากไม่ทราบ coverage และอนาคต; ไม่อ้าง complete โดยไม่มีหลักฐาน
12. **Compatibility:** `/all`, summary/dashboard ที่ไม่ส่ง contract=v2 และ device downtime เดิมตอบ shape/ความหมายเดิม authเดิม ไม่มี static route ถูก `/devices/:id` กลืน
13. **Validation:** dates ไม่มีtimezone/ย้อนช่วง/เกิน366วัน, yearในv2, enumผิด, page_size101, qยาวเกิน, queryไม่รู้จักคืน400
14. **Performance:** ส่งขนาดข้อมูลจริง ระยะเวลา query และ query plan ที่ใช้; pagination ไม่ดึงทุก record มาค่อย slice ในแอป ทบทวน index ตาม filter/sort จริง ไม่สร้าง index โดยเดาจาก frontend

## 12. ลำดับส่งมอบ

1. ยืนยัน schema mapping/นิยามในหัวข้อ13 และสร้าง fixtures ของ boundary/duration
2. ทำ shared filter/normalization/snapshot ให้ใช้ร่วมกันทุก endpoint
3. ทำ incidents + summary v2 แล้วตรวจ consistency
4. ทำ dashboard v2 + selectors และตรวจ drill-down/coverage
5. ทดสอบผู้เรียกเดิม ส่งตัวอย่าง request/response สำเร็จ/empty/error พร้อมผล contract tests และข้อจำกัด

## 13. รายการที่ขอให้ Backend ยืนยันก่อนส่งต่อ Frontend

- ชื่อ table/PK และชนิด ID, mapping device/สำนักงาน/province/IP รวมกรณี device ถูกลบ
- enum สถานะจริง, null up_at หมายถึงอะไร, duration เดิมมาจากสูตรใด มีเหตุซ้อนหรือไม่
- timezone ของ timestamp เดิม โดยเฉพาะค่าที่ไม่มี offset และแนวทาง migration/ตีความ
- source ของ currently_offline_count เดิมและเวลาอัปเดต มี distinct device count จริงหรือไม่
- มีข้อมูล coverage/monitoring gaps หรือไม่ ถ้าไม่มีให้ unknown/null ตามสเปก ไม่สร้างข้อมูลให้ดูครบ
- วิธี snapshot ที่ทำได้จริง อายุ/ข้อจำกัด/การเก็บข้อมูลและการเปลี่ยนสิทธิ์
- auth เดิม public หรือ roleใดเข้าถึงได้; คง policy เดิมและบอก scope ที่ query ใช้
- ยืนยันเลือก contract=v2 หรือเสนอ version path ทดแทน พร้อมตัวอย่าง response ก่อนเชื่อม frontend

หาก field ใดไม่มีใน schema ให้รายงานว่าไม่มีและคืน null/unknown ตามความหมาย อย่าใช้0หรือชื่อสมมติแทนข้อมูลจริง ตัวอย่างในเอกสารนี้เป็นข้อมูลประกอบสเปกเท่านั้น
