# แผนปรับปรุงหน้าประวัติการขัดข้อง

เส้นทาง `/downtime-history` · วันที่ 24 กันยายน 2026 · สถานะ: ดำเนินการ frontend v2 แล้ว ดูผลตรวจรับใน [DOWNTIME_HISTORY_IMPLEMENTATION.md](DOWNTIME_HISTORY_IMPLEMENTATION.md)

อ้างอิง [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md), [DowntimeHistory.jsx](src/components/DowntimeHistory.jsx) และการเปิดรายละเอียดอุปกรณ์ใน [App.jsx](src/App.jsx)

เนื้อหาแผนเดิมด้านล่างจัดทำจาก source code ก่อนเริ่มงาน ต่อมา backend ส่ง contract ที่ทำเสร็จแล้วใน DOWNTIME_HISTORY_V2.md และนำมาใช้พัฒนา frontend; ผลตรวจ API/หน้าจอจริงและข้อจำกัดอยู่ในเอกสารผลดำเนินการข้างต้น

## 1. เป้าหมายและสิ่งที่ต้องรักษา

ให้ผู้ใช้เห็นว่าเกิดเหตุที่ไหน เมื่อใด นานเท่าไร ยังไม่จบหรือกลับออนไลน์แล้ว และเปิดอุปกรณ์เพื่อตรวจสอบต่อได้ โดยไม่สับสนระหว่างจำนวนเหตุการณ์กับจำนวนอุปกรณ์

คงฟีเจอร์เดิมทั้งหมด: การ์ดสรุปสามรายการ, สรุปทั้งปี, 10 อันดับอุปกรณ์ขัดข้องบ่อยและการเปิดรายละเอียด, กราฟรายเดือน/รายวัน, ค้นหา, กรองจังหวัด, เรียงจังหวัด/เวลาเริ่มขัดข้อง และแบ่งหน้า เริ่มต้น 15 รายการต่อหน้า

เพิ่มการเชื่อมโยงกราฟกับรายการเป็นงานต่อยอด ไม่กล่าวว่าเป็นฟีเจอร์เดิม เพราะกราฟปัจจุบันมี tooltip แต่ยังไม่มี click handler สำหรับกรองรายการ ส่วน export ยังไม่มี UI/handler แม้ import ไอคอน Download จึงไม่รวมเป็นฟีเจอร์เดิมและไม่เพิ่มในรอบแรก

## 2. ปัญหาที่ตรวจพบ

| ลำดับ | ปัญหาในปัจจุบัน | สิ่งที่ต้องแก้ |
|---|---|---|
| P0 | คำค้น/จังหวัดกรองเฉพาะตาราง แต่ summary รวมประวัติและ dashboard รายปีไม่เปลี่ยน | ระบุขอบเขตแต่ละส่วนให้ชัดทันที; เป้าหมายระยะถัดไปใช้ filter เดียวกันเมื่อ API รองรับ |
| P0 | `formatDuration(...)` คืน `-` เมื่อไม่มีข้อมูล ทำให้ `||` ไม่ไปใช้ fallback `duration_ms` | normalize duration ก่อน format ใช้เลข milliseconds เป็นหลัก; แยก missing กับศูนย์ |
| P0 | `log.status.toUpperCase()` อาจพังเมื่อ status หาย; ทุกค่าที่ไม่ใช่ down ใช้สีเขียว | map เฉพาะค่าที่ contract ยืนยัน ค่าอื่นแสดงไม่ทราบสถานะ |
| P0 | summary โหลดไม่สำเร็จอาจเห็นเป็น 0; fetch ไม่ตรวจ HTTP status และ error แค่ console | ตรวจ status/shape แยก loading/error/empty/stale และมี retry |
| P1 | fetch สามชุดด้วย Promise.all และใช้ loading ทั้งหน้า | ให้แต่ละส่วนแสดงผล/ข้อผิดพลาดอิสระ คงข้อมูลเก่าระหว่าง refresh |
| P1 | โหลด `/all` ทั้งหมดแล้ว filter/sort/page ใน browser | ตรวจความครบและขนาดข้อมูลก่อน; วางทางเปลี่ยนเป็น server pagination โดยไม่คำนวณสรุปจากหน้าเดียว |
| P1 | ไม่มีช่วงวันที่/เลือกปี/status filter แต่ dashboard มีปีที่ API ส่งมา | เพิ่มเมื่อยืนยัน API และนิยามช่วงเวลาแล้ว ไม่สร้าง dropdown ที่เปลี่ยนเฉพาะชื่อหัวกราฟ |
| P1 | กราฟ grid `1fr 1.4fr`, search 300px และกลุ่ม controls ไม่ wrap ภายใน | responsive CSS ตามพื้นที่จริง รองรับ sidebar และมือถือ |
| P1 | Top devices เป็น div click, หัวตาราง click และปุ่ม pagination ไม่มีชื่อ | ใช้ link/button จริง, aria-sort, accessible labels, เป้าสัมผัส 44px |
| P1 | ชื่ออุปกรณ์ตารางยาวขึ้นหลายบรรทัดและยังเปิดรายละเอียดไม่ได้ | ชื่อบรรทัดเดียว ellipsis พร้อม title บน desktop และทางอ่านเต็มบน mobile; เพิ่มลิงก์รายละเอียดเมื่อมี ID |
| P1 | ไม่มีการจำ filter/page/scroll เมื่อกลับจากรายละเอียด | URL สำหรับ filter/sort/page และ session สำหรับ scroll/focus พร้อม source context |
| P2 | ใช้ไอคอนถ้วยรางวัลกับอุปกรณ์ที่มีปัญหา | เปลี่ยนเป็นไอคอนเตือน/กิจกรรมและชื่อ “อุปกรณ์ที่ควรติดตาม” พร้อมบอกเกณฑ์จัดอันดับ |

## 3. โครงสร้างหน้าและ responsive

ลำดับหลัก: หัวหน้าและเวลาอัปเดต → ข้อผิดพลาด/ข้อมูลเก่า → ตัวกรองและขอบเขตข้อมูล → การ์ดสรุป → แนวโน้มและอันดับ → รายการเหตุการณ์

### Desktop

- หัวหน้า “ประวัติการขัดข้อง” คำอธิบายสั้นและปุ่มรีเฟรช มีทางลัดไปส่วนรายการเพื่อไม่ต้องเลื่อนผ่านกราฟทุกครั้ง
- Toolbar ใช้ label เหนือ control ช่องค้นหาและ dropdown สูงเท่ากัน ปุ่มค้นหา/ล้างตัวกรองแยกแถวชิดขวาเมื่อพื้นที่ไม่พอ ไม่ยืดปุ่มจนผิดสัดส่วน
- การ์ดสรุปสามคอลัมน์ ตัวเลข 28–32px และหน่วย “เหตุการณ์”, “อุปกรณ์”, “เวลาสะสม” ชัดเจน
- กราฟรายเดือนและอันดับใช้สองคอลัมน์เมื่ออ่านได้; กราฟรายวันเต็มแถว ปรับ container ด้วย min-width:0
- ตาราง: สำนักงาน/อุปกรณ์, IP (หากมี), จังหวัด, เริ่มขัดข้อง, กลับออนไลน์, ระยะเวลา, สถานะ และทางเปิดรายละเอียด ข้อมูลตัวเลขชิดขวา หัวคอลัมน์ตรงกับข้อมูล
- ชื่อ/สำนักงานหนึ่งบรรทัดและ ellipsis ไม่มีขีดใต้ชื่อ; วันเวลาไม่ตัดจนแยกเริ่ม/จบไม่ได้ ตารางเลื่อนใน panel ได้

### Mobile/Tablet

- เรียง panel คอลัมน์เดียว; การ์ดสรุปไม่บังคับ min-width จนล้นจอ; ตัวกรองเรียงลงและปุ่มอย่างน้อย 44px
- กราฟทั้งสองและอันดับยังเข้าถึงครบ พับส่วนแนวโน้มได้แต่ไม่ลบฟีเจอร์ มีปุ่ม “ดูข้อมูลกราฟเป็นตาราง” สำหรับการอ่านค่าจริง
- รายการใช้ card เหตุการณ์: ชื่อ/สถานะ → IP/จังหวัด → เริ่ม/จบ → ระยะเวลา → ดูอุปกรณ์ มี label ทุกค่า ไม่พึ่งตำแหน่งคอลัมน์จาก desktop
- ข้อความยาวเปิดดูเต็มหรือขึ้นบรรทัดในรายละเอียด ไม่พึ่ง mouse hover; pagination มีช่วงรายการและก่อนหน้า/ถัดไปที่แตะง่าย
- ตรวจที่ 360, 390, 768, 1280 และ 1440px พร้อม sidebar ทั้งสองสถานะ และ zoom 200%

## 4. รูปแบบและการใช้งานตามมาตรฐาน

- ใช้ ListPage.css สำหรับ controls/panel/table ที่เหมาะสม และ scoped DowntimeHistory.css สำหรับกราฟ/card ไม่แก้ global `.glass`
- Krub, เนื้อหาสำคัญ 16px, label/ข้อมูลรองอย่างน้อย 13–14px; panel radius16, control radius8, padding20/16 และ focus ring3px
- แดง = ยังขัดข้อง, เขียว = เหตุการณ์สิ้นสุด/กลับออนไลน์, สีเป็นกลาง = ไม่ทราบข้อมูล มีข้อความกำกับเสมอ; สถานะเหตุการณ์เก่าไม่ใช่สถานะสดของอุปกรณ์
- คำค้น/ตัวกรองที่มีค่าต้องไฮไลท์ทันทีและเมื่อ restore ค่า “ทั้งหมด”/ช่องว่างไม่ไฮไลท์; การไฮไลท์ไม่ได้หมายความว่ากดค้นหาแล้ว
- ทุก input/select มี label จริง; กด Enter เพื่อค้นหาได้ ล้างแล้วคืนค่าเริ่มต้นและหน้า1; แยก draft/applied filters และแสดง chips ของเงื่อนไขที่ใช้อยู่
- ใช้ลิงก์สำหรับเปิดรายละเอียดอุปกรณ์ มี fallback อ่านข้อมูลเหตุการณ์เมื่ออุปกรณ์ถูกลบหรือไม่มี ID
- ใช้ปุ่มใน th พร้อม aria-sort แทน th onClick; pagination มีชื่อและ disabled ที่ถูกต้อง
- เคารพ reduced motion ทั้งภายในหน้าและ parent; ไม่ใช้ animation ยก panel ที่คลิกไม่ได้

## 5. นิยามข้อมูลที่ต้องตกลงก่อนรวมกราฟกับตัวกรอง

1. **จำนวนเหตุการณ์ ≠ จำนวนอุปกรณ์:** อุปกรณ์หนึ่งตัวมีหลายเหตุการณ์ได้ ป้ายกำลังขัดข้องต้องระบุว่าเป็น distinct devices หรือ open incidents ตาม contract
2. **ขอบเขตปัจจุบันต่างกัน:** summary เดิมเป็นภาพรวมตามคำอธิบาย UI ส่วน dashboard มี year และตารางเป็น logs ที่กรองเอง ระยะแรกให้แยกป้าย “ภาพรวมทั้งหมด”, “แนวโน้มปี…”, “รายการตามตัวกรอง” ห้ามทำให้ผู้ใช้เข้าใจว่าทั้งหมดถูกกรองแล้ว
3. **เป้าหมายช่วงเวลา:** เสนอเลือกเหตุการณ์ที่ช่วงขัดข้องทับช่วงค้นหา (`down_at < to_exclusive` และ `up_at > from` หรือยังไม่จบ) ไม่ใช่เฉพาะเหตุการณ์ที่เริ่มในช่วง เพราะจะทำให้เหตุข้ามวัน/ข้ามปีหาย
4. **การนับในกราฟ:** แยก `started_incident_count` (เริ่มในวัน/เดือนนั้น) ออกจากจำนวนเหตุการณ์ที่ทับช่วง; ผลรวมจำนวนเริ่มรายวันต้องเท่าจำนวนเริ่มทั้งช่วง แต่ไม่จำเป็นต้องเท่าจำนวนรายการ overlap
5. **เวลาสะสม:** รวมเฉพาะช่วงที่ทับ filter โดยตัดขอบช่วงและใช้เวลา snapshot เดียวกันสำหรับเหตุที่ยังไม่จบ ป้ายต้องบอกว่าเป็นเวลาสะสมของอุปกรณ์ จึงอาจเกินจำนวนชั่วโมงของช่วงปฏิทิน ไม่ใช่เวลาที่ทั้งองค์กรใช้งานไม่ได้
6. **จำนวนกำลังขัดข้อง:** หากหมายถึงสถานะปัจจุบันให้เป็นการ์ดแยกจาก filter ประวัติอย่างชัดเจน; หากต้องการ “ยังไม่สิ้นสุด ณ เวลา snapshot ในชุดผลนี้” ให้เปลี่ยน label และ contract ให้ตรงกัน
7. **เวลาและปี:** API ส่ง ISO8601 พร้อม offset/UTC; แสดง Asia/Bangkok ชัดเจน ใช้ ค.ศ. ใน query และ พ.ศ. (ค.ศ.) ในตัวเลือกได้ วันที่สิ้นสุดบน UI รวมทั้งวัน แต่แปลงเป็นขอบบน exclusive วันถัดไป ไม่ใช้ 23:59:59 ที่ตกหล่น milliseconds
8. **duration:** ใช้ finite non-negative duration_ms ก่อนข้อความ formatted; 0 แสดง “0 วินาที”, null เป็น —, ค่าติดลบ/วันที่ผิดรูปแบบแสดงข้อมูลไม่สมบูรณ์ ไม่คำนวณต่ออย่างเงียบ ๆ
9. **เหตุการณ์ยังไม่จบ:** ถ้ามีข้อมูลพอ คำนวณถึง as_of และระบุ “ณ เวลา…”; ห้ามเพิ่มเวลาทุกวินาทีแต่ summary/กราฟใช้ snapshot เก่าโดยไม่บอก
10. **ข้อมูลหายกับไม่มีเหตุ:** เติมกราฟเป็น 0 เฉพาะช่วงที่ backend รับรอง coverage ครบ; ช่องที่ไม่มีข้อมูลเป็น gap ไม่ลากเส้นผ่านราวกับวัดแล้ว ไม่สร้าง uptime%, SLA หรือ MTTR จนมีฐานข้อมูล/นิยามรองรับ

## 6. กราฟและการเปิดรายละเอียด

- คงจำนวนเหตุการณ์รายเดือน/รายวันและ tooltip ระยะเวลารายเดือน เพิ่มปี/ช่วงวันที่/หน่วยให้ชัด ใช้สีที่อ่านได้ทั้งสองธีมและ ticks ที่ไม่แน่นบนมือถือ
- อันดับเริ่มจากจำนวนเหตุการณ์ตามเดิม แสดงระยะเวลาประกอบและเกณฑ์ตัดสินเมื่อจำนวนเท่ากัน ไม่เปลี่ยนเป็นจัดอันดับตาม duration โดยไม่เปลี่ยนชื่อ
- ระยะต่อยอด: กดแท่งเดือนหรือจุดวันแล้วแสดงรายการเหตุการณ์ที่ “เริ่มในช่วงนั้น” ให้สอดคล้องกับค่ากราฟ พร้อม chip และล้าง drill-down ได้; ต้องส่ง match mode ใน query ไม่ใช้ overlap แล้วได้จำนวนไม่ตรง
- มีตารางหรือปุ่มวัน/เดือนที่ทำงานเดียวกันสำหรับ keyboard/touch ไม่ผูกงานหลักกับ tooltip
- กดชื่อในอันดับยังเปิดอุปกรณ์ตามเดิม ส่วน “ดูเหตุการณ์ของอุปกรณ์นี้” ถ้าเพิ่มต้องเป็นคำสั่งแยก ไม่เปลี่ยนพฤติกรรมคลิกเดิมโดยเงียบ ๆ
- เปิดรายละเอียดแล้ว Back ทั้ง browser/ปุ่มแอปคืนหน้าเดิมพร้อม filters/page/scroll/focus; ตรวจ App.jsx ไม่สมมติว่าต้องกลับหน้า devices เสมอ

## 7. API ที่ใช้อยู่และข้อจำกัด

ทุกเส้นทางเติม VITE_API_BASE_URL; frontend ส่ง Bearer token เมื่อมี คง authorization เดิม

| API | ข้อมูลที่ frontend อ่าน | สิ่งที่ต้องยืนยัน |
|---|---|---|
| GET `/api/devices/downtime/summary` | success/data: total_incidents, currently_offline_count, total_downtime_formatted | scope, distinct device count, รวม open incidents หรือไม่, snapshot และ duration_ms |
| GET `/api/devices/downtime/all` | success/data array: id, pea_name, province, down_at, up_at, duration_formatted/ms, status, device.pea_name/province/gateway | ส่งครบจริงหรือมี limit แฝง, device ID, nullable fields, status enum, timezone, ขนาดข้อมูล |
| GET `/api/devices/downtime/dashboard` | root year/yearly/monthly/daily/top_devices; incident_count, duration_ms/formatted, device_id | รองรับ year/filter หรือไม่, daily ครอบคลุมช่วงไหน, นิยามนับและ duration, coverage |

**ปรับ UI และแก้ข้อผิดพลาด P0 ด้วย API เดิมได้ก่อน** แต่การกรองทั้งหน้า เลือกปี และ server pagination ต้องให้ backend ยืนยันหรือเพิ่มความสามารถ ไม่ควรดึงหนึ่งหน้าแล้วทำยอดรวม/อันดับเอง

## 8. ข้อเสนอส่งต่อ Backend สำหรับระยะถัดไป

สเปกสำหรับส่งพัฒนาฉบับละเอียด: [DOWNTIME_HISTORY_BACKEND_API_SPEC.md](DOWNTIME_HISTORY_BACKEND_API_SPEC.md) รวมการแยก contract v2, snapshot, request/response และ contract tests ให้ใช้ไฟล์ดังกล่าวเป็นข้อเสนอหลักในการตกลงกับ backend

เสนอขยาย API summary/dashboard แบบ backward-compatible และเพิ่ม GET `/api/devices/downtime/incidents` สำหรับรายการแบ่งหน้า โดยคง `/all` ไว้ให้ผู้เรียกเดิม ถ้า backend มี endpoint เทียบเท่าอยู่แล้วให้ใช้ของเดิม ไม่สร้างซ้ำ

### Query ร่วม

- `date_from`, `date_to_exclusive`: ISO8601; `timezone=Asia/Bangkok`
- `q`: ค้นหาชื่อสำนักงาน/อุปกรณ์/IP ทั้งชุด ไม่ใช่เฉพาะหน้าปัจจุบัน; กรองสถานะแยกด้วย `status`
- `province`, `device_id`, `status=open|resolved|unknown`
- `match=overlap|started`: default overlap; drill-down จำนวนเริ่มจากกราฟใช้ started
- รายการเพิ่ม `page`, `page_size`, `sort_by=down_at|up_at|duration_ms|province`, `sort_order=asc|desc`; จำกัดขนาดและ whitelist sort ที่ backend มี tie-break ด้วย incident ID
- หากใช้ year selector ให้แปลงเป็นช่วงวันที่ ไม่ส่ง year กับ dates ที่ขัดกัน; API เดิมที่รับ year ต้องระบุ precedence หรือปฏิเสธ query ขัดแย้ง

### Response ที่ต้องการ

| ส่วน | Fields/ข้อกำหนด |
|---|---|
| รายการ | incident_id คงที่, device_id nullable, device_name/pea_name, gateway/IP, province, down_at, up_at nullable, status, duration_ms, duration_in_range_ms |
| Pagination | page, page_size, total_items, total_pages |
| Summary | matched_incident_count, affected_device_count, started_incident_count, open_incident_count, total_duration_in_range_ms; current offline count แยก scope ถ้ามี |
| Dashboard | daily/monthly buckets มี period_start/end, started_incident_count, duration_in_range_ms; top_devices และอันดับภายใต้ filter เดียวกัน |
| Meta | applied_filters, timezone, as_of, data_updated_at, coverage (ช่วงที่มีข้อมูล/ความครบ), นิยาม match/duration; ใช้ snapshot เดียวกันข้าม endpoint เพื่อเทียบยอดได้ |

ต้องตกลงกลไก snapshot หากข้อมูลเปลี่ยนระหว่าง requests: เช่น backend ส่ง snapshot token จากคำขอแรกแล้วให้คำขอถัดไปใช้ หรือ response รวมรายการและ aggregates; ไม่กล่าวว่ายอดจะตรงกันเสมอเพียงเพราะ filter เท่ากัน

หาก provinces/ปีต้องมาจากข้อมูลทั้งหมดเมื่อเปลี่ยนเป็น pagination เสนอ GET `/api/devices/downtime/selectors` คืน available_years/provinces ภายใต้สิทธิ์เดิม ห้ามสร้างตัวเลือกจากรายการหน้าเดียว หากมี selector กลางที่ครบอยู่แล้วให้ใช้ก่อน

Validation: วันที่เริ่มต้องน้อยกว่าสิ้นสุด, enum/sort/page ถูกต้อง, response error มี code/message; ช่วงว่างคืนรายการว่างและยอด0 เมื่อ query สำเร็จจริง ส่วน 401/403/5xx ไม่ส่ง empty-success แทน

ยังไม่ขอ export API, SLA หรือ incident detail endpoint ใหม่ รอบแรกเปิดข้อมูลเต็มจาก record ที่โหลดมาและลิงก์ device เดิมได้

## 9. Request lifecycle และ persistence

- แยก loading/error/stale ของ summary/dashboard/list; ตรวจ HTTP status และ shape ก่อนใช้ข้อมูล มี retry รายส่วน/refresh ทั้งหน้า
- Abort คำขอเมื่อ unmount/filter เปลี่ยน พร้อมป้องกัน response เก่าทับ query ใหม่ ใช้ timeout และไม่ส่งคำขอซ้ำซ้อน
- URL เก็บ applied filters/sort/page; session เก็บ scroll/focus และ draft ตามความจำเป็น มี version/validation และ fallback เมื่อ storage ใช้ไม่ได้ ไม่เก็บ token ใน snapshot
- เปลี่ยน filter/sort กลับหน้า1; refresh แล้วจำนวนหน้าลดลงให้ปรับหน้าให้อยู่ในขอบเขต; ศูนย์รายการแสดง “0 รายการ” ไม่ใช่หน้า1จาก0
- แยก “ยังไม่มีประวัติ”, “ไม่พบตามตัวกรอง” และ “โหลดไม่สำเร็จ” พร้อมทางแก้ และแสดงผลเก่าชัดเจนเมื่อ refresh ล้มเหลว
- รอบแรกใช้ manual refresh พร้อมเวลาข้อมูล ไม่เพิ่ม polling โดยไม่จำเป็น; ถ้าเพิ่มภายหลังให้ pause เมื่อแท็บซ่อนและไม่เปลี่ยน page/focus ของผู้ใช้

## 10. แผนดำเนินงาน

1. **ยืนยัน contract:** ตรวจตัวอย่าง success/error, enum, timezone, duration, coverage และปริมาณ `/all`; ตกลงนิยามในส่วน5 และความสามารถ backend ในส่วน8
2. **P0 ด้วย API เดิม:** แก้ duration fallback/status/null/error, ป้าย scope และเวลาอัปเดต แยก request states โดยไม่รอ API ใหม่
3. **UI มาตรฐาน:** scoped CSS, responsive cards/table/charts, labels/focus/filled states, pagination และลิงก์รายละเอียดพร้อม restore context
4. **การกรองทั้งหน้า:** เมื่อ backend พร้อม เปลี่ยนเป็น server pagination/shared filters เพิ่มช่วงวัน/ปี/status และ drill-down ที่จำนวนตรงกับกราฟ ไม่ปล่อย controls ที่ยังทำงานไม่ครบ
5. **ตรวจรับ/คู่มือ:** อัปเดต USER_GUIDE.md และ GUIDE_SECTIONS ใน About.jsx ตาม flow ที่ทำจริง พร้อม lint/build และการทดสอบพฤติกรรมสำคัญ

## 11. เกณฑ์ตรวจรับ

- [ ] ฟีเจอร์เดิมครบทั้ง summary/อันดับ/กราฟสองแบบ/ค้นหา/จังหวัด/sort/pagination/เปิดอุปกรณ์
- [ ] desktop/mobile ทุกขนาดที่ระบุ, light/dark, sidebar, zoom200%, ชื่อไทยยาวไม่มี page overflow
- [ ] controls สมส่วน มีไฮไลท์ค่าที่กรอกและ restore; keyboard/label/focus/aria-sort และรายละเอียดเต็มบน touch ใช้งานได้
- [ ] duration0, null, formatted หายแต่ ms มี, status หาย/ไม่รู้จัก, วันเวลา invalid ไม่ทำหน้าพังหรือแสดงเขียวผิด
- [ ] เหตุการณ์ข้ามวัน/เดือน/ปีและ open incident คำนวณช่วงทับซ้อนถูกต้อง; timezone ไม่ทำเหตุหลุดขอบช่วง
- [ ] กราฟเริ่มรายวันรวมเท่าจำนวนเริ่มทั้งช่วง; duration buckets รวมเท่า summary ภายใต้ snapshot/coverage เดียวกัน; overlap count ไม่ถูกบังคับให้เท่าจำนวนเริ่ม
- [ ] ส่วนใดโหลดล้มเหลวไม่กลายเป็นยอด0 และไม่ซ่อนส่วนที่สำเร็จ; retry/timeout/cancel/คำตอบสลับลำดับทำงานถูกต้อง
- [ ] pagination ไม่มีข้อมูลซ้ำ/ข้ามเมื่อ sort tie, เปลี่ยน filter กลับหน้า1, refresh แล้วหน้าลดลงไม่ค้างหน้าว่าง
- [ ] กราฟ drill-down ได้รายการตามนิยาม count พร้อมทางเลือก keyboard และล้างเงื่อนไขได้
- [ ] เปิด device แล้ว Back คืน filters/page/scroll/focus; deep link ไม่มีบริบทต้นทางก็ย้อนกลับได้เหมาะสม
- [ ] selector และสรุปครอบคลุมทั้งชุด ไม่ใช้ข้อมูลหน้าเดียว; การเปลี่ยนผู้ใช้ไม่คืนข้อมูลข้ามสิทธิ์
- [ ] lint/build ผ่าน และทดสอบสูตร duration/filter semantics/async race อย่างมีความหมาย ระบุสิ่งที่ยังไม่ได้ทดสอบก่อนส่งงาน
