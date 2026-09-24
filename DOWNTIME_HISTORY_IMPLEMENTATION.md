# ผลปรับปรุง Downtime History v2

วันที่ 24 กันยายน 2026

## สิ่งที่ดำเนินการ

- เชื่อม summary/dashboard contract=v2, incidents server pagination และ selectors ตาม DOWNTIME_HISTORY_V2.md ที่ backend ส่งมา
- ใช้ snapshot เดียวสำหรับทุกส่วน รวมการค้นหา เปลี่ยนหน้า เรียง และ drill-down; เก็บ token ที่ยังใช้ได้ใน session ของแท็บเพื่อกลับหน้าโดยไม่สร้าง snapshot ซ้ำ รองรับ TTL/410 และ invalid token
- เพิ่มปี/ช่วงวันที่ไม่เกิน 366 วัน คำค้นสำนักงาน/IP จังหวัด สถานะ และวิธีนับ overlap/started พร้อม filled highlight และ URL สำหรับการกลับ/refresh/deep link
- คงการ์ดสรุปสามรายการ อันดับ10 กราฟรายเดือน/รายวัน และการเปิดอุปกรณ์ เพิ่มการเปิดรายการจากแท่ง/จุดกราฟและปุ่มในตารางข้อมูลกราฟ
- ตาราง desktop แถวปกติบรรทัดเดียว แยก IP มี ellipsis/ข้อมูลเต็ม และมือถือใช้การ์ดพร้อมชื่อเต็ม/ระยะเวลาทั้งเหตุการณ์และภายในช่วง
- แยกจำนวนเหตุการณ์/อุปกรณ์ รวมถึงประวัติยังไม่ปิดทั้งระบบซึ่งไม่ใช่ ping สดตามข้อจำกัด backend; ไม่เติมศูนย์แทน coverage unknown หรือ future
- แยก error/loading รายส่วน คงผลเดิมพร้อมเวลาและข้อความเมื่อ refresh ไม่สำเร็จ; เมื่อได้ snapshot ใหม่จะนำส่วนเก่าออกก่อนแสดงข้อมูลชุดใหม่ ป้องกันยอดข้าม snapshot
- เพิ่ม abort/timeout/response validation, ป้องกันคำตอบเก่าทับใหม่ และแก้กรณีเปลี่ยนหน้าก่อนกราฟโหลดเสร็จ
- ปรับหน้าที่เกินขอบเขตอัตโนมัติ กลับจากรายละเอียดผ่านปุ่มในแอปหรือ browser Back ได้พร้อมเงื่อนไข/หน้าและ restore ตำแหน่ง
- อัปเดตคู่มือ USER_GUIDE.md และ About.jsx ให้ตรงกัน

## ไฟล์หลัก

- `src/components/downtime/DowntimeHistory.jsx` และ CSS: ฟอร์ม การแสดงผล กราฟ ตาราง/cards
- `src/components/downtime/useDowntime.js`: request lifecycle/shared snapshot
- `src/components/downtime/downtimeData.js`: query/date/format/storage/request utilities
- `src/components/downtime/downtimeData.test.mjs`: unit tests
- `src/components/DowntimeHistory.jsx`: re-export เพื่อคง import เดิม
- `src/App.jsx`: return context ของอุปกรณ์ที่เปิดจากประวัติ

## ผลตรวจ

1. API จริงจาก base URL ของ project: summary 672 เหตุการณ์, 179 อุปกรณ์ และ 3 เหตุการณ์ไม่มีอุปกรณ์เชื่อมโยง ณ เวลาตรวจ; dashboard และรายการใช้งานได้ด้วย token ร่วม
2. Browser จริงแบบ headless: viewport 360/390/768/1280/1440px; ตรวจทั้ง light/dark ที่360/768/1280 ไม่ล้นแนวนอน ปุ่ม/ช่องฟอร์มสูง46px และมือถือเปลี่ยนเป็น cards
3. คลิกแท่งเดือน/จุดรายวัน → query เป็น started และช่วง bucket, pagination, sort, คำค้นที่ไม่พบ, ล้าง, reload และเปิด device → browser Back/ปุ่ม Back ในแอป ผ่าน
4. จำลอง dashboard503: summary/list ที่สำเร็จยังอยู่และ retry ได้; จำลอง incidents410: ล้างทั้งชุดแล้ว retry สร้างชุดใหม่ ไม่มีข้อมูลปะปน
5. Deep link page9999 ปรับเป็นหน้าสุดท้าย45 ตามข้อมูลทดสอบ กราฟไม่ค้าง; initial load ใน React StrictMode สร้าง snapshot เพียงหนึ่งครั้ง
6. Unit tests4กรณี ผ่าน: missing/zero duration, leap day/date range/URL encoding, bucket clipping/filter preservation, malformed URL validation
7. ESLint ของไฟล์ DowntimeHistory และ directory downtime ผ่าน; production build ผ่าน มีคำเตือน bundle >500kB
8. ESLint ของไฟล์ร่วม App.jsx/About.jsx ยังมีปัญหาเดิม motion unused, ref mutation และ dependencies; ตรวจเทียบเนื้อหา HEAD แล้วพบชุดปัญหาเดียวกัน จึงไม่ได้ขยายงานไปแก้ auth/idle timeout ที่ไม่เกี่ยวข้อง

คำสั่ง unit test บนเครื่องนี้: `node --test --test-isolation=none src/components/downtime/downtimeData.test.mjs` เพื่อเลี่ยง sandbox จำกัดการ spawn test worker

## ขอบเขตการตรวจและข้อจำกัด

- ทดสอบ browser กับ API อ่านจริงและ mock error ไม่ได้แก้ข้อมูลต้นทางหรือรัน migration backend
- ตรวจ reflow ที่ viewport640 ซึ่งเทียบพื้นที่ใช้งาน desktop1280 zoom200%; ยังไม่ได้ตรวจ browser zoom200% จริงทุกส่วน หรือ screen reader จริงบนอุปกรณ์มือถือ
- coverage ยัง unknown ตาม backend และจำนวนประวัติไม่ปิดอาจล่าช้าจากระบบ monitoring จึงแสดงคำอธิบาย ไม่อ้างว่าเป็นสถานะสดหรือ SLA
- ใช้ policy public read ตาม backend ปัจจุบัน token snapshot ไม่ใช่ข้อมูล auth; หากภายหลังเปลี่ยนเป็นสิทธิ์รายบัญชีต้องปรับ scope และการเก็บ snapshot ตาม backend
- ยังไม่ได้ commit/push ในงานนี้
