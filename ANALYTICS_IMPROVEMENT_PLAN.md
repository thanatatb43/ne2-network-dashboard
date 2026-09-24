# แผนปรับปรุงหน้าตรวจสอบการเชื่อมต่อ (Analytics)

วันที่: 24 กันยายน 2026 · เส้นทาง `/analytics` · สถานะ: เสนอแผน ยังไม่เริ่มแก้ implementation

อ้างอิง [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md), [Analytics.jsx](src/components/Analytics.jsx), การเรียกประวัติใน [Management.jsx](src/components/Management.jsx) และรายการ API ใน README

แผนนี้ตรวจจากโค้ดปัจจุบัน ยังไม่ได้ตรวจภาพจริงทุก viewport หรือยืนยัน response ของ backend สด และไม่ได้รันทดสอบความเร็ว/ส่งรายงานจริง ข้อเสนอ contract ด้านล่างจึงไม่ใช่การยืนยันว่า backend รองรับแล้ว

## 1. เป้าหมายและขอบเขต

ทำให้ผู้ใช้ตอบได้ว่า “เครื่องนี้เชื่อมต่อผ่านอะไร”, “ทดสอบไปถึงที่ไหน” และ “ผลล่าสุดเป็นอย่างไร” โดยรองรับ desktop/mobile และอ่านง่ายสำหรับผู้สูงอายุ

คงความสามารถเดิมครบ: ทดสอบ Download/Upload/Latency, แสดง Public IP/IP ที่ backend เห็น/Hostname/MAC, ตรวจสามปลายทางอัตโนมัติทุก 30 วินาที, ตรวจ IPv4 ที่กรอกเองพร้อม latency/packet loss/สำนักงาน/เวลาตรวจ และส่งรายงานหลังทดสอบ คงสิทธิ์และรูปแบบ authentication เดิม ตรวจที่ route และ backend ก่อนเปลี่ยน

ไม่เพิ่มกราฟประวัติหรือคะแนน “ดี/แย่” โดยไม่มีข้อมูลรองรับ และไม่เรียกการทดสอบความเร็วอัตโนมัติเมื่อเข้าหน้า

## 2. ปัญหาที่พบจากโค้ดและลำดับแก้

| ลำดับ | สิ่งที่พบ | แนวทาง |
|---|---|---|
| P0 | ค่าเริ่มต้นปลายทางเป็น `online: true`; Public Network แสดง ACTIVE ตลอด | เริ่มเป็น “ยังไม่ได้ตรวจสอบ”; แยกกำลังโหลด/ตอบสนอง/ไม่ตอบสนอง/ตรวจสอบไม่ได้ และ stale |
| P0 | ช่วงวัด Latency หน้าปัดใช้ `progress * 10` แต่ติดป้าย Mb/s Download | แสดงค่าที่วัดจริงตามขั้นตอน: ms สำหรับเวลาตอบกลับ และ Mbps สำหรับความเร็ว; ก่อนมีค่าใช้ — |
| P0 | fetch หลายจุดไม่ตรวจ HTTP status รวมถึงการส่ง report | ตรวจ status/shape ทุกคำขอ แยกผลการทดสอบกับสถานะบันทึกรายงาน; ห้ามแสดงบันทึกสำเร็จเมื่อ API ล้มเหลว |
| P0 | ป้าย ONLINE/OFFLINE ไม่บอกว่าผู้ใดเป็นผู้ ping | อธิบายจุดวัดตาม contract; หากวัดจาก backend ต้องบอกว่า “จากเซิร์ฟเวอร์” ไม่สรุปว่าเครื่องผู้ใช้เข้าถึงได้ |
| P1 | Grid `1fr 350px`, หน้าปัด 320px, padding มาก และ inline styles | ทำ scoped CSS และ grid ตามพื้นที่ใช้งานจริง; ไม่ให้มือถือหรือ sidebar ดันหน้าล้น |
| P1 | ปุ่มมุม 32px, glass panels และตัวอักษรบางส่วนเล็กมาก | panel 16px, control 8px, สูงอย่างน้อย 44px, เนื้อหาหลัก 16px ตามมาตรฐาน |
| P1 | ไม่มี cancel ครอบคลุมทั้ง run; cleanup หยุดเฉพาะ interval | ยกเลิก fetch/reader/XHR/timer เมื่อหยุดหรือออกหน้า และป้องกันผล run เก่าทับ run ใหม่ |
| P1 | ข้อผิดพลาดบางส่วนลง console เท่านั้น ไม่มีเวลาความสด | แจ้งข้อผิดพลาดเฉพาะ panel พร้อมลองใหม่ และเวลาสำเร็จล่าสุด |
| P1 | ช่อง IP ไม่มี label ที่ผูก input, outline none, ไม่มีไฮไลท์เมื่อกรอก | ใช้ label, focus ring, filled state, inline validation และ Enter submit |
| P1 | แก้ค่า IP แล้วผลเดิมยังอยู่โดยไม่มีคำอธิบาย | ผูกผลกับ submitted IP แสดงชัดว่าผลของ IP ใด; ไม่ให้คำตอบล่าช้าทับคำขอใหม่ |
| P2 | ผล/ข้อความกรอกหายเมื่อกลับเข้าหน้า | เก็บบริบทใน session ตามผู้ใช้ พร้อม timestamp; ไม่คืนสถานะกำลังทดสอบหรือรันซ้ำเอง |

## 3. โครงสร้างหน้าที่เสนอ

ชื่อหน้า **ตรวจสอบการเชื่อมต่อ** และคำอธิบาย “ทดสอบความเร็วถึงเซิร์ฟเวอร์ของระบบ และตรวจสอบการตอบสนองของปลายทาง” โดยปรับชื่อจุดวัดเมื่อ backend ยืนยัน

### Desktop

- แถวหัวหน้า: ชื่อ/คำอธิบาย และ “รีเฟรชข้อมูลการเชื่อมต่อ” ซึ่งไม่เริ่ม Speed Test
- พื้นที่หลักสองคอลัมน์เมื่อมีพื้นที่พอ: ซ้ายประมาณ 2 ส่วนเป็น Speed Test; ขวาประมาณ 1 ส่วนเป็นข้อมูลเครื่องและสถานะสามปลายทาง ใช้ `minmax(0, ...)` ป้องกันข้อความดัน grid
- ส่วน Speed Test: ชื่อเซิร์ฟเวอร์/ขอบเขตการวัด → Download, Upload, Latency → ขั้นตอนและ progress → ปุ่มเริ่ม/หยุด → เวลาทดสอบและสถานะบันทึก
- ยังคงหน้าปัดได้แต่ลดให้เป็นภาพประกอบ ค่าตัวเลขทั้งสามต้องอ่านได้โดยไม่ต้องตีความวงแหวน; สเกลเดิม 1,000 Mbps ต้องไม่ทำให้ค่าที่สูงกว่าถูกตัดหรือดูเหมือนคะแนนคุณภาพ
- ส่วนตรวจ IP เต็มแถวด้านล่าง: label เหนือ input และปุ่มตรวจสอบ/ล้างอยู่ระดับเดียวกับ control ไม่ยืดปุ่มตามความสูง panel

### Tablet และ Mobile

- เปลี่ยนเป็นคอลัมน์เดียวตามพื้นที่เนื้อหาจริง ไม่ยึดเฉพาะความกว้าง viewport เพราะมี sidebar
- ลำดับ: หัวหน้า → Speed Test → ข้อมูลการเชื่อมต่อ/ปลายทาง → ตรวจ IP
- ค่าทดสอบสามช่องเป็นแถวเมื่ออ่านได้; จอแคบให้เรียงลง ห้ามลดฟอนต์จนอ่านยาก หน้าปัดใช้ขนาดไม่เกินพื้นที่ container
- ช่อง IP เต็มแถว ปุ่มอยู่แถวถัดไป ขนาดสมส่วนและอย่างน้อย 44px; ผลสำนักงานยาวขึ้นบรรทัดได้
- IP/Hostname/MAC ยาวต้องมีทางอ่านครบและคัดลอกได้ ไม่พึ่ง hover; ห้ามทั้งหน้าเลื่อนแนวนอน

## 4. สี ภาษา และ accessibility

- ใช้ tokens และฟอนต์ Krub ร่วมกับระบบ ไม่แก้ `.glass` หรือ `button` แบบ global
- Download/Upload มีสีแยกคงที่ พร้อมชื่อและไอคอน สีตัวเลขต้องอ่านได้ทั้ง light/dark; ไม่ใช้สีเป็นหลักฐานว่าสปีดดีหรือแย่
- ปลายทางใช้ “ตอบสนอง”, “ไม่ตอบสนอง”, “ตรวจสอบไม่ได้”, “ยังไม่ได้ตรวจสอบ” พร้อมข้อความอธิบายว่าการไม่ตอบ ping ไม่ได้ยืนยันว่าอุปกรณ์เสีย
- ตัวเลขสำคัญ 28–40px, หน่วย 14–16px, tabular numerals; IP ใช้ monospace เท่าที่จำเป็น
- ใช้ Mbps ให้สม่ำเสมอ และ ms สำหรับเวลาตอบกลับ; ค่า missing เป็น —, ค่า 0 ที่ถูกต้องยังต้องแสดง ไม่ใช้ `||` แทน null check
- ฟอร์ม IP ใช้ label/aria-describedby/aria-invalid และ filled highlight หลังกรอกหรือ restore; ล้างแล้วกลับสภาพเดิม
- progress มี accessible name และค่าความคืบหน้า; live region แจ้งเมื่อเปลี่ยนขั้นตอน ไม่อ่านค่าความเร็วทุก frame
- รองรับ Tab/Enter/Space, focus ring 3px, zoom 200% และ reduced motion รวม parent transition

## 5. ความถูกต้องของ Speed Test และการจัดการ state

1. ใช้ phase ชัดเจน `idle → latency → download → upload → completed` พร้อม `cancelled/failed` แยกจากข้อความภาษาไทย ห้ามตรวจ phase ด้วย `testStatus.includes(...)`
2. คงหน้าต่างวัด Download 12 วินาทีและ Upload 12 วินาทีในรอบแรก แสดงว่าเวลารวมมี Latency เพิ่ม ไม่รับประกันเสร็จภายใน 24 วินาที
3. Latency ปัจจุบันวัด HTTP request ไป upload endpoint 10 ครั้ง จึงต้องเรียก “เวลาตอบกลับ HTTP ถึงเซิร์ฟเวอร์” ไม่กล่าวว่าเป็น ICMP Ping หรือ Jitter; ยังไม่แสดง Jitter เพราะยังไม่มีนิยามการคำนวณใน UI
4. Download ตรวจ response.ok/body, ป้องกัน cache และใช้จำนวน byte/เวลาจริง ไม่รวม error page เป็นข้อมูลทดสอบ; หลีกเลี่ยง compression ที่ทำให้ตัวเลขคลาดเคลื่อนโดยยืนยัน headers กับ backend
5. Upload จาก XHR progress คือมุมมอง browser ไม่ใช่หลักฐาน byte ที่ backend รับครบ โดยเฉพาะ chunk ที่ abort เมื่อหมดเวลา ต้องแสดงขอบเขตวิธีวัดและไม่อ้างว่าเป็น server-confirmed throughput
6. แยก abort จากครบเวลาวัด, ผู้ใช้ยกเลิก, ออกจากหน้า และ timeout; เฉพาะกรณีครบหน้าต่างวัดจึงนำ byte บางส่วนมาคำนวณตามวิธีเดิม ไม่ส่ง report สำเร็จเมื่อผู้ใช้ยกเลิกหรือรอบล้มเหลว
7. มี timeout ต่อคำขอและขีดจำกัดเวลารวม, run ID, controller/reader/XHR references; ปิดคำขอเมื่อ unmount และไม่ให้คำตอบเก่าทับ state ใหม่
8. เก็บผลรอบก่อนแยกจากรอบที่กำลังวัด หากล้มเหลวระหว่างทางให้เห็นว่าเป็นผลบางส่วน ไม่ติดป้ายว่าทดสอบครบแล้ว
9. แสดงสถานะบันทึกแยก: กำลังบันทึก/บันทึกแล้ว/บันทึกไม่ได้/ยังยืนยันไม่ได้ โดย report response ที่หายกลางทางอาจบันทึกจริงแล้ว ห้าม retry อัตโนมัติจนมีวิธีป้องกันรายงานซ้ำ
10. ไม่มีการจัดระดับ “ช้า/เร็ว” แบบตายตัวจนกว่าจะมีเกณฑ์และความเร็วที่ควรได้รับของเส้นทางนั้น

## 6. การโหลดข้อมูลและจำบริบท

- Connection details, endpoint status และ IP lookup มี loading/error/retry อิสระ ไม่ให้ส่วนเดียวล้มแล้วทั้งหน้าหาย
- คงรอบตรวจ 30 วินาที แต่ใช้ scheduling หลังคำขอก่อนจบเพื่อไม่ซ้อน; pause เมื่อแท็บซ่อน และ refresh เมื่อกลับมา ระหว่าง Speed Test อาจพักเพื่อไม่รบกวนการวัด พร้อมบอกผู้ใช้และ refresh หลังจบ
- ก่อนมีข้อมูลใช้ unknown; ถ้า refresh ล้มเหลวเก็บผลเก่าและแสดง “ข้อมูลล่าสุดเมื่อ… อัปเดตไม่สำเร็จ”; รายการที่ API ไม่ส่งคืนต้องไม่กลายเป็นออนไลน์
- เก็บ IP ที่กรอกและ snapshot ผลสำเร็จล่าสุดพร้อมเวลาใน sessionStorage แยกตามผู้ใช้ มี version/validation และ fallback เมื่อ storage ใช้ไม่ได้ ล้างเมื่อ logout/เปลี่ยนผู้ใช้
- ไม่เก็บ token ใน snapshot; ไม่บันทึก state ทดสอบที่กำลังทำงานให้กลับมารันต่อ การกลับหน้าแสดงผลเดิมในฐานะ “ผลครั้งก่อน” และโหลดสถานะปัจจุบันใหม่

## 7. API เดิมที่ใช้ต่อได้

เส้นทางอ้างอิงตาม frontend โดยเติม `VITE_API_BASE_URL` ข้างหน้า ต้องยืนยัน shape จริงก่อน implementation

| Endpoint | การใช้งาน/ข้อมูลที่โค้ดอ่าน | สิ่งที่ต้องตรวจ contract |
|---|---|---|
| `GET /api/test/my-ip` | ip/client_ip, hostname/computer_name/name, mac_address/mac/physical_address; รองรับ data wrapper | IP เป็น client ที่ server เห็นหรือ local IP จริง, proxy handling, แหล่ง hostname/MAC และ null เมื่อหาไม่ได้ |
| `POST /api/test/ping-check` | body `{ips:[...]}`; success/data array: ip, alive, latency_ms/latency | ผู้ส่ง probe, หน่วย ms, เวลา, timeout/error ต่อปลายทาง; ห้ามเอา API failure ไปแทน alive=false |
| `GET /api/test/check-ip/:ip` | alive, ip, latency_ms, packet_loss, checked_at, site.pea_name/province | response wrapper, ขอบเขต IPv4, packet loss เป็น 0–100 หรือหน่วยใด, null semantics, จุดวัด |
| `GET /api/test/download` | response stream สำหรับนับ bytes | ขนาดข้อมูล, cache/compression headers, rate limit และ cancellation |
| `POST /api/test/upload` | latency request ว่าง และ upload binary chunk 4 MiB | รองรับ empty body/binary, ขนาดสูงสุด, timeout, success semantics และ response เมื่อรับครบ |
| `POST /api/test/report` | form-urlencoded: download_speed, upload_speed, latency, computer_name, mac_address, user_id; bearer เมื่อมี | หน่วยตัวเลข, required fields, identity จริง (ปัจจุบันส่งชื่อผู้ใช้ใน user_id), response ยืนยันบันทึก, idempotency |
| `GET /api/test/history` | มีใช้อยู่ใน Management พร้อม auth | ยังไม่ดึงมาหน้านี้; ถ้าจะเพิ่มประวัติส่วนตัวต้องยืนยันสิทธิ์/ตัวกรอง/pagination ก่อน |
| `https://api.ipify.org?format=json` | Public IP จากฝั่ง browser | บริการภายนอกอาจล้มเหลวแยกจากเครือข่ายภายใน จึงไม่ใช้ผลเป็น ACTIVE ของทั้งระบบ |

Hostname/MAC ไม่ใช่ข้อมูลที่ browser อ่านตรงได้ทั่วไป หาก backend ไม่มีหลักฐานต้องแสดง “ไม่ทราบ” ไม่อนุมานจาก IP และไม่ใช้ IP ของ backend ออกอินเทอร์เน็ตมาแทน Public IP ของเครื่องผู้ใช้

## 8. ข้อมูลที่ขอจาก Backend และ API ใหม่

**งานปรับ layout, responsive, accessibility, state และแก้การแสดงผลหลอกไม่ต้องรอ endpoint ใหม่** ใช้ API เดิมได้ แต่ก่อนยืนยันความหมายข้อมูล/การบันทึก ต้องขอตัวอย่าง response สำเร็จและ error ของเส้นทางด้านบน พร้อมตอบข้อสงสัยเรื่องจุดวัดและหน่วย

### 8.1 ขอขยาย contract เดิมเมื่อยังไม่มีข้อมูลเหล่านี้

- `ping-check` และ `check-ip`: เพิ่มแบบ backward-compatible เป็น `checked_at` (ISO 8601 พร้อม timezone), `probe_source` (เช่น backend), `status` (`reachable | unreachable | error`), `error_code` ที่เป็น null เมื่อไม่มีข้อผิดพลาด; คง `alive` เดิมให้ client อื่นใช้งานต่อ
- `my-ip`: ยืนยัน canonical fields และแหล่งข้อมูล; เสนอเพิ่ม `ip_source`, `observed_at` โดย hostname/MAC เป็น nullable ไม่ใส่ค่าตัวอย่างแทนของจริง
- `report`: response ยืนยันด้วย `report_id`, `saved_at`; หากต้องการปุ่มบันทึกซ้ำอย่างปลอดภัย ให้รองรับ `client_run_id`/idempotency key โดย retry ID เดิมต้องไม่สร้างรายงานซ้ำ และผูก ID กับผู้ใช้ตาม authentication เดิม
- อย่าเปลี่ยน `user_id` จากชื่อเป็นเลขทันทีจนกว่าจะตรวจผู้เรียกเดิมและตกลง migration; backend ควรยืนยันผู้บันทึกจาก auth ตาม policy ที่มีอยู่

หาก backend ยังไม่เพิ่ม ให้ใช้เวลารับ response ฝั่ง client พร้อมป้ายที่ตรงความหมาย, แสดงจุดวัดเท่าที่ได้รับการยืนยัน และงดปุ่ม retry report ที่เสี่ยงสร้างรายการซ้ำ ไม่ปิดกั้นงาน UI ทั้งหมด

### 8.2 Endpoint ใหม่ที่เสนอเป็นทางเลือก ไม่ใช่ข้อบังคับรอบแรก

`GET /api/test/config` — ใช้เมื่ออยากให้เปลี่ยนเซิร์ฟเวอร์/รายชื่อปลายทาง/วิธีวัดจาก backend โดยไม่ deploy frontend

ตัวอย่าง contract ที่เสนอ (ต้องตกลงก่อนสร้าง):

```json
{
  "data": {
    "test_server": { "id": "ne2", "label": "เซิร์ฟเวอร์ NE2", "scope": "client_to_server" },
    "latency_method": "http_round_trip",
    "download_duration_ms": 12000,
    "upload_duration_ms": 12000,
    "upload_chunk_bytes": 4194304,
    "poll_interval_ms": 30000,
    "probe_source": "backend",
    "targets": [
      { "id": "pea-hq", "label": "เครือข่ายภายใน (PEA HQ)", "ip": "172.30.204.33" },
      { "id": "ne2", "label": "กฟฉ.2", "ip": "172.21.1.18" },
      { "id": "external", "label": "ปลายทางภายนอก", "ip": "8.8.8.8" }
    ]
  }
}
```

Frontend ต้อง validate ค่าระยะเวลา/ขนาดและใช้ขอบเขตที่ตกลงกัน ไม่รับค่า config ที่ทำให้ทดสอบไม่สิ้นสุด หากยังไม่ทำ endpoint นี้ให้รวมค่าปัจจุบันไว้ใน config ฝั่ง frontend พร้อมชื่อจุดวัดที่ backend ยืนยัน

ไม่ขอ endpoint history ใหม่ซ้ำของเดิม ไม่ขอ API public-ip ที่วัดจาก server แทน browser และยังไม่เพิ่มงาน schema ประวัติหรือกราฟแนวโน้มในขอบเขตรอบแรก

## 9. ลำดับดำเนินงาน

1. **ยืนยันข้อมูล:** เก็บตัวอย่าง response/สถานะ error, จุดวัด ping/HTTP และ report identity; ตกลงส่วน 8.1 และตัดสินใจว่าจะใช้ config endpoint หรือ frontend config
2. **แก้ความถูกต้อง P0:** unknown states, ค่าตาม phase, ตรวจ HTTP status/shape, แยก report state, request cancellation และ stale protection
3. **ปรับหน้าตา:** แยก `Analytics.css` ที่ scope เฉพาะหน้า, จัด responsive panels, ฟอร์ม/ปุ่มมาตรฐาน, focus/filled state และข้อมูลอ่านง่าย
4. **เพิ่มบริบท:** session snapshot, เวลาผลล่าสุด, copy ข้อมูลที่มีจริงพร้อมแจ้งผล; การคัดลอกต้องมี fallback สำหรับ deployment HTTP ที่ Clipboard API อาจใช้ไม่ได้
5. **ตรวจรับและคู่มือ:** ทดสอบ flow เสี่ยงด้วย mock ไม่ส่งข้อมูลทดสอบปนประวัติจริง; อัปเดต USER_GUIDE.md และ GUIDE_SECTIONS ใน About.jsx ให้ตรงกัน

แนะนำแยก hook การวัด/การยกเลิกออกจาก JSX และมี adapter สำหรับ contract เดิม ไม่จำเป็นต้องสร้าง design system ใหม่ทั้งระบบหรือแก้หน้า Management ในงานนี้

## 10. เกณฑ์ตรวจรับ

- [ ] ความสามารถเดิมครบ โดยไม่มีการเริ่ม Speed Test เมื่อเปิดหน้า/refresh/back
- [ ] Desktop 1280/1440, tablet 768, mobile 360/390px ทั้ง light/dark, sidebar เปิด/ปิด, ข้อความไทยยาว และ zoom 200% ไม่มี page overflow
- [ ] ปุ่มและฟอร์มระดับเดียวกันบน desktop; mobile อ่านผลครบ; ช่องกรอกมีค่าแล้วไฮไลท์ ล้าง/restore ทำงานถูกต้อง
- [ ] เริ่มหน้าไม่แสดงออนไลน์หรือ 0 Mbps เสมือนวัดแล้ว; ค่า latency 0 และ packet loss 0 แสดงได้ถูกต้อง
- [ ] 4xx/5xx, JSON ผิดรูปแบบ, response ขาดบางปลายทาง, network error และ stale ไม่ถูกตีความเป็นผลสำเร็จ
- [ ] มีเฉพาะค่าที่วัดจริงตาม phase; หน่วย/ขอบเขต browser-to-server และ server-to-target ชัดเจน
- [ ] Stop/ออกหน้า/เริ่มใหม่ไม่ทิ้ง fetch/XHR/timer ไม่ส่ง report ของรอบยกเลิก และผลเก่าไม่ทับรอบใหม่
- [ ] ครบหน้าต่างวัดกับผู้ใช้ยกเลิกแยกกัน; download ไม่มี body/ล้มเหลว และ upload abort/error ไม่สร้าง false success
- [ ] Report ล้มเหลวไม่ทำให้ผลทดสอบหาย; retry ไม่ทำรายงานซ้ำเมื่อ backend รองรับ idempotency
- [ ] ตรวจ IP ด้วย Enter, validation, ข้อมูลสำนักงานยาว, เปลี่ยน IP ระหว่างรอ, API error และผลไม่มีข้อมูลสำนักงาน
- [ ] Back/refresh แสดง snapshot พร้อมเวลา ไม่กลับมารันเอง; เปลี่ยนผู้ใช้/logout/storage เสียไม่แสดงบริบทข้ามบัญชี
- [ ] Keyboard, screen reader labels/live feedback, reduced motion, contrast และการคัดลอกบน HTTP ใช้งานได้
- [ ] lint/build ผ่าน และตรวจ flow cancellation/partial failure ด้วยการทดสอบที่มีความหมาย; ระบุผลจริงและส่วนที่ยังไม่ทดสอบเมื่อส่งงาน
