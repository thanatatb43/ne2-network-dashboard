# สรุปข้อตกลง Frontend–Backend สำหรับ Office Equipment Dashboard

วันที่: 6 ตุลาคม 2569

ตอบกลับ: `FRONTEND_REPLY_WITH_DASHBOARD_API_2026-10-06.md`

สถานะ: Frontend ยอมรับแนวทางตามเอกสารตอบกลับและเริ่มพัฒนา UI Phase 1 ได้ แต่ยังไม่ใช่การรับรอง integration หรืออนุมัติเปิดใช้งาน production งานที่ backend ระบุว่ายังไม่ implement จะยังไม่เปิดเรียกจาก UI

## 1. ข้อตกลงที่ยืนยันแล้ว

### 1.1 การล้างข้อความในฟอร์มทะเบียนอุปกรณ์

- เมื่อช่องเคยมีค่า แล้วผู้ใช้ลบจนว่างและกดบันทึก frontend ส่ง string `"-"` ตามพฤติกรรมเดิม
- Backend แปลง `"-"` เป็น null เฉพาะ nullable text allowlist ที่ระบุในเอกสารตอบกลับ รวม `equipment_code` และ `wifi_mac_address`
- Backend normalize ก่อนตรวจรูปแบบ IP/MAC และอ่านกลับได้ null
- ค่าที่มีขีดเป็นส่วนหนึ่ง เช่น `PC-001` ไม่ใช่คำสั่งล้าง
- ไม่ขยายกติกานี้ไปยัง required fields, integer หรือ photos ที่เป็น JSON
- Frontend ใช้ `application/x-www-form-urlencoded` เดิม
- กรณี success แบบ no changes ที่ไม่มี data ให้ถือว่าบันทึกสำเร็จได้ และใช้ GET รายละเอียดเมื่อต้องอ่านค่าที่ server จัดเก็บจริง

ยอมรับนิยาม quality missing เดิม คือ NULL/empty/whitespace โดยไม่เพิ่มกฎให้ข้อความทุกชนิดที่เป็น `-` กลายเป็น missing การล้างผ่าน allowlist ที่จัดเก็บเป็น null จะเข้ากติกา missing อยู่แล้ว

รับทราบว่า backend รายงานการ normalize ข้อมูลเก่าพร้อม audit แล้ว Frontend ไม่ส่งคำสั่ง cleanup ซ้ำ และข้อตกลงนี้ไม่ใช่คำขอให้แก้ข้อมูลย้อนหลังเพิ่มเติม

### 1.2 สิทธิ์ Phase 1

| Endpoint | สิทธิ์ที่ UI จะใช้ |
|---|---|
| `/dashboard/selectors` | Public |
| `/dashboard/summary` | Public |
| `/dashboard/distribution` | Public |
| `/dashboard/quality` | Public |
| `/dashboard/equipment` | Public รวม fields ตาม schema |
| `/dashboard/contracts` | Public |
| `/dashboard/export` | Bearer token; ทุก role ที่ authenticated |
| `GET /api/office-equipment/:id` | Public ตาม route เดิม |
| เพิ่ม/แก้ไข/ลบทะเบียน | Auth และ roles เดิม |

Paths `/dashboard/*` ในตารางอยู่ภายใต้ `/api/office-equipment`

หน้าแรกดู dashboard ได้โดยไม่ล็อกอิน เมื่อกด export จึงให้เข้าสู่ระบบ ข้อมูล export ใช้ scope เดียวกับตารางตาม contract ของ backend ส่วน 403/503 ไม่เป็นเหตุให้ล้าง session อัตโนมัติ

### 1.3 API Phase 1 และการแสดงผล

- ใช้รายละเอียด API ที่แนบในเอกสารตอบกลับ โดยให้ข้อตกลงล่าสุดส่วนต้นมีผลเหนือข้อความเก่าในภาคผนวกที่ขัดกัน
- ใช้ selectors จาก backend ไม่ hardcode ประเภทหรือสถานะ
- ตาราง dashboard ใช้ `/dashboard/equipment`; รายละเอียดรายเครื่องใช้ `/:id` เดิม
- กราฟสำนักงานใช้ชื่อ “สำนักงานในระบบ” ไม่อ้างว่าเป็นตำแหน่งติดตั้งจริง
- ใช้ filters ให้ตรงกับแต่ละ endpoint และไม่ส่ง parameter ที่ยังไม่รองรับ
- Export ใช้ filters/sort ของตาราง โดยไม่ส่ง page/limit
- หลาย request เป็นข้อมูลสด ไม่ใช่ snapshot ร่วม จึงไม่รับรองว่ายอดข้าม widget ตรงกันทุกขณะหากมีการแก้ทะเบียนระหว่างโหลด
- ค่าตัวอย่างและผล performance ในเอกสารเป็นข้อมูลอ้างอิง ณ เวลาที่ backend บันทึก ไม่ใช่ยอดปัจจุบันหรือผลทดสอบซ้ำของ frontend

## 2. ประเด็นเพิ่มเติมที่ขอ backend ยืนยัน: การล้างวันที่สัญญา

ตรวจพบว่า serializer ของฟอร์มปัจจุบันส่ง `"-"` เมื่อผู้ใช้ลบค่าเดิม รวมถึง `contract_start_date` และ `contract_expiry_date` แต่ contract ล่าสุดของ backend ระบุว่า dash normalization ไม่ใช้กับ date columns

เพื่อให้ตรงกับพฤติกรรมฟอร์มที่ผู้ใช้ต้องการ **ขอเพิ่มการรองรับ string `"-"` สำหรับสองฟิลด์นี้โดยเฉพาะ แล้วแปลงเป็น null ก่อนตรวจรูปแบบวันที่**:

```text
contract_start_date=-&contract_expiry_date=-
```

ผลที่ต้องการเมื่ออ่านกลับ:

```json
{
  "contract_start_date": null,
  "contract_expiry_date": null
}
```

ข้อนี้เป็นคำขอเพิ่มเติมที่ยังรอ backend ยืนยัน ไม่ใช่ข้อสรุปว่าโค้ดปัจจุบันรองรับแล้ว และไม่ใช่การขยาย sentinel ไปยัง date columns ทั้งระบบ

หากไม่สามารถรองรับได้ ขอแจ้งเหตุผลและ contract สำหรับล้างสองฟิลด์นี้ก่อน integration ห้ามปล่อยให้ UI แจ้งบันทึกสำเร็จทั้งที่วันที่เดิมยังคงอยู่โดยผู้ใช้ไม่ทราบ

ขอมี regression test ผ่าน HTTP form สำหรับล้างวันเริ่มอย่างเดียว ล้างวันสิ้นสุดอย่างเดียว และล้างทั้งคู่ โดยตรวจค่าที่อ่านกลับจริง

## 3. กลุ่มคอมพิวเตอร์: ตกลงแนวทาง แต่รอ implementation

ยอมรับ `equipment_group=computer` หมายถึง PC + Notebook ไม่รวม Monitor ตามแนวทาง backend:

- ใช้ AND กับ equipment_type
- ใช้ shared filter ทุก endpoint Phase 1 และต่อไป Phase 2
- Selectors คงขอบเขต group ขณะยกเว้นตัวกรอง equipment_type ของตัวเอง
- คืน group ใน meta.filters และ sheet Filters ของ export
- Group ที่ไม่รองรับตอบ 400 INVALID_QUERY

**Frontend จะยังไม่ส่ง parameter นี้จนกว่า backend ส่งมอบ implementation พร้อม schema/tests** ระหว่างนี้สามารถพัฒนา dashboard อุปกรณ์ทั้งหมดหรือเลือกประเภทเดียวได้ แต่จะไม่เปิดตัวกรองรวม PC + Notebook และไม่รวมรายการจาก pagination เองเพื่อทดแทน

## 4. Export และ Wi-Fi MAC: งานค้างก่อนตรวจรับ integration

### Export

- Frontend ดาวน์โหลดผ่าน fetch พร้อม Bearer token แล้วจัดการ binary response
- Backend expose `Content-Disposition` ผ่าน CORS สำหรับ frontend ต่าง origin
- หาก UI ใช้ `X-Export-Total` ขอ expose header นี้ด้วย
- ขอไฟล์ตัวอย่างและทดสอบ browser จริงทั้งดาวน์โหลดสำเร็จ, ไม่มี session, token หมดอายุ และ 422 EXPORT_TOO_LARGE
- Error response ต้องมี Content-Type และ JSON envelope ที่แยกจากไฟล์สำเร็จได้

### Wi-Fi MAC

- Frontend เพิ่มช่องอ่าน/เขียน normalization และ validation รวมการล้างด้วย `"-"`
- Backend ยังต้องแก้ค่ารูปแบบผิดให้ตอบ 400 และเพิ่ม test โดย client validation ไม่ทดแทน server validation
- ทดสอบทั้งค่าถูกต้อง ค่าผิดรูปแบบ และการล้างค่าเดิมแล้วอ่านกลับเป็น null

## 5. Phase 2: ยอมรับแบบข้อมูล แต่ยังไม่เปิดใช้งานจริง

ยอมรับแนวทาง loans/repairs ตามคำตอบล่าสุด:

- เพิ่ม `pea_site_id`, `pea_site_name`, `equipment_type` ใน items ทั้งสองเส้น
- ยังไม่ต้องเพิ่ม borrower_contact, endpoint ดูทั้ง batch หรือสถานะงานเดี่ยวในแถว repairs
- Batch แสดงเฉพาะรายการที่อยู่ในหน้าปัจจุบัน ไม่อ้างว่ามีสมาชิกหน้าอื่นเมื่อไม่มี metadata
- Loans summary ใช้ filters รวม loan_status ก่อน pagination; from/to หมายถึงช่วง borrowed_at
- Repairs ใช้ summary.repair_job_count สำหรับจำนวนงานที่ไม่ซ้ำ ไม่บวก repair_count จากทุกแถว
- เปิดรายละเอียดรายเครื่องเป็นประวัติทั้งหมด ไม่อ้างว่ากรองตามช่วงวันที่ของ dashboard
- page >= 1 default 1; limit 1–100 default 20
- ใช้ tie-breaker และวาง due_date null ท้ายทั้ง asc/desc ตามที่ backend ยืนยัน

Phase 2 ยังเป็นงานออกแบบ/ยังไม่ implement Frontend ทำ UI จาก mock ได้ แต่ยังไม่เรียกเป็นฟีเจอร์จริง โดยคงแผน authenticated ไว้ก่อนและรอข้อยืนยันสิทธิ์ก่อนเปิดใช้ **เอกสารนี้ไม่อนุมัติ public Phase 2**

## 6. การแสดงวันที่สัญญาไม่ตรงกัน

เมื่อ `date_inconsistent=true` UI จะแสดง badge **“วันที่สัญญาไม่ตรงกัน”** โดยไม่ระบุจำนวนอุปกรณ์ที่ผิดต่าง

เหตุผล: start_dates และ expiry_dates เป็นจำนวนแยกมิติ ไม่สามารถบวกเป็นจำนวนอุปกรณ์ที่ผิดต่างแบบไม่ซ้ำได้ เพราะอาจเป็นเครื่องเดียวกัน จึงไม่จำเป็นต้องเพิ่ม API สำหรับรุ่นแรก หากต้องการจำนวนดังกล่าวในอนาคตต้องกำหนดนิยามและ field เพิ่ม

## 7. สิ่งที่ต้องพร้อมก่อนรับรอง integration/deploy

- [ ] Backend ตอบข้อเสนอการล้างวันที่สัญญาในข้อ 2 และส่งมอบพฤติกรรมที่ตกลง
- [ ] ยืนยัน URL dev ที่ frontend เข้าถึงได้ พร้อมกำหนด deploy
- [ ] Migrations/columns `equipment_code`, `wifi_mac_address` และ auth middleware ที่ dashboard พึ่งพาพร้อมใน environment เป้าหมาย
- [ ] Wi-Fi MAC ผิดรูปแบบตอบ 400 และการล้างค่าผ่าน HTTP form ทำงานตาม contract
- [ ] Export ผ่าน browser จริง รวม CORS และ error responses
- [ ] equipment_group พร้อมก่อนเปิดตัวกรองรวมคอมพิวเตอร์
- [ ] ทดสอบร่วม auth/logout/session, job sort, history pagination และ coordinates ตาม handoff
- [ ] ทดสอบ dashboard filters, KPI, drill-down, pagination และ export บนข้อมูลทดสอบคงที่
- [ ] Phase 2 implement และยืนยันสิทธิ์ก่อนเปิดใช้; ไม่ต้องรอ Phase 2 เพื่อเริ่มงาน UI Phase 1

Frontend เริ่มพัฒนา UI Phase 1 ตาม contract ที่พร้อมแล้วได้ การรับรองพร้อมใช้งานจริงจะเกิดหลังทดสอบร่วมกับ backend environment ไม่ใช้ผล unit tests ของ frontend หรือผลที่รายงานในเอกสารแทน integration test
