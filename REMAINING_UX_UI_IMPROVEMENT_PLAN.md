# แผนปรับปรุง UX/UI หน้าที่เหลือให้เป็นมาตรฐานเดียวกัน

วันที่ตรวจ: 27 กันยายน 2026 · สถานะ: เอกสารแผน ยังไม่ได้แก้โค้ดหน้าต่าง ๆ ในงานตรวจรอบนี้

อ้างอิง [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) และ route/component ปัจจุบันใน [App.jsx](src/App.jsx)

## 1. ขอบเขตและวิธีอ่านผล

ตรวจ source code ของ route หลัก หน้าจัดการ ตารางย่อย และ modal ที่ใช้ร่วมกัน เทียบกับมาตรฐานด้านข้อมูล ภาษา controls ตาราง responsive accessibility และการกลับหน้าเดิม ไม่ใช้เพียงการพบ inline style หรือ `.glass` เป็นหลักฐานว่าหน้าไม่ผ่าน

**ข้อค้นพบจากโค้ด** คือพฤติกรรม/markup ที่ระบุได้จาก implementation ส่วน **ต้องตรวจ browser ต่อ** คือขนาดจริง การล้นจอ contrast focus และประสบการณ์บนอุปกรณ์จริง ยังไม่ได้ทำ visual/keyboard audit ทุกหน้าหรือทดสอบ write action ในรอบนี้

ตรวจ API อ่านจริงเฉพาะ shape/pagination ของ `/api/budgets/transactions` เพื่อยืนยันประเด็นความครบของรายการ ไม่ได้แก้ข้อมูลหรือสิทธิ์ใน backend

มีงานฟอร์มอุปกรณ์ร่วมอยู่ใน working tree ระหว่างตรวจ (`equipment-form`, `OfficeSiteEquipment`, `EquipmentEdit`) จึงใช้สถานะล่าสุดนี้และไม่สรุปว่าฟอร์มยังซ้ำเหมือนก่อนหน้า ห้าม overwrite งานดังกล่าวเมื่อเริ่มแผนนี้

ระดับความสำคัญ:

- **P0:** ข้อมูลผิดความหมาย/ไม่ครบ หรือทำให้ผู้ใช้ตัดสินใจผิด ต้องแก้ก่อนตกแต่ง
- **P1:** งานหลักใช้ยากหรือไม่สม่ำเสมอ เช่น ตาราง/ฟอร์ม/modal/การย้อนกลับ
- **P2:** เก็บรายละเอียด ภาษา semantics และตรวจ regression ของหน้าที่ปรับแล้ว

## 2. ทะเบียนหน้าและลำดับงาน

| หน้า / เส้นทาง | สถานะจากการตรวจ | ลำดับ / งานหลัก |
|---|---|---|
| `/down-devices` | ยังใช้ตาราง/toolbar เดิม; error/ค้นหาไม่พบอาจบอกว่าไม่มีอุปกรณ์ขัดข้อง | P0 ข้อมูล → P1 layout |
| `/device/:id` | status normalization มีกรณี undefined ถูกตีความออนไลน์; ตารางประวัติ/ผล scan และ layout เดิม | P0 สถานะ → P1 รายละเอียด |
| `/management/budget` | ธุรกรรมโหลดเฉพาะหน้าแรกแต่ค้นหา/sort/page ฝั่ง client; ตารางและ modal เดิม | P0 ความครบ → P1 management UI |
| `/management/stock` | มีการจำ filters/selection แล้ว แต่ตาราง คำสั่งกลุ่ม modal และ storage fallback ยังต้องปรับ | P1 |
| `/equipment-loans` | มี API pagination และกลุ่ม batch แต่ UI/filter/error/persistence ยังต่างจากหน้ารายการหลัก | P1 |
| `/management/network/devices` | มี session persistence บางส่วน แต่ toolbar/form/table ใช้รูปแบบเดิม | P1 |
| `/management/jobs` | ตารางงาน/ธุรกรรม หัวตาราง onClick และ dialog หลายแบบ | P1 |
| `/settings` | หน้าผู้ใช้/สำนักงาน ตาราง/ฟอร์ม/modal และภาษาอังกฤษยังไม่สม่ำเสมอ | P1 |
| `/management/network/history` | ตารางประวัติ Speed Test ใน Management.jsx ยังเป็น UI เดิม | P1 |
| `/management`, `/management/network` | การ์ด navigation มี div click และ grid min-width300px | P2 พร้อมทำหลังหน้าปลายทาง |
| `/management/computers` | รายชื่อสำนักงานใน wrapper ยังควรเก็บ toolbar/list/navigation | P1 ร่วมงานฟอร์มเดิม |
| `/management/computers/:siteId`, `/equipment/new/edit`, `/equipment/:id/edit` | มี implementation ฟอร์มร่วมใหม่ใน working tree | ตรวจตามแผนเฉพาะ ไม่เขียนใหม่ซ้ำ |
| `/equipment/:id` | layout เคยปรับแล้ว แต่ modal ประวัติ/ยืม/QR ที่เรียกใช้ยังเป็นจุดร่วมเก่า | P1 เฉพาะ modal, P2 regression หน้า |
| `/login`, `/sso-callback`, `/about` | ไม่ใช่หน้าตาราง; login labels/focus และภาษา/feedback ควรตรวจให้ครบ | P2 |
| `/`, `/network-devices`, `/devices` | มี implementation มาตรฐานบางส่วน/มากแล้ว | P2 regression และเก็บจุดย่อย |
| `/equipment-search`, `/equipment-borrow` | ใช้ ListPage, caption/scope และ layout ใหม่แล้ว | P2 regression โดยเฉพาะ modal ร่วม |
| `/report-issue`, `/report-issue/:id` | มีรูปแบบใหม่และ modal a11y บางส่วนแล้ว | P2 ตรวจ picker/ประวัติร่วม ไม่ย้อนกลับเป็น UI เดิม |
| `/analytics`, `/downtime-history` | มีงานใหม่และเอกสารผลดำเนินการแล้ว | P2 เก็บ semantics/ข้อยกเว้นมาตรฐาน |
| `/budget-dashboard`, `/budget-dashboard/search` | แยกจาก BudgetManagement; ใช้ API ใหม่และตารางมาตรฐานแล้ว | P2 regression ไม่เอาปัญหาหน้าจัดการไปเหมารวม |

รายการ “มีมาตรฐานแล้วบางส่วน” ไม่ใช่การรับรองว่าผ่าน accessibility/ทุก viewport ครบทั้งหมด

## 3. งาน P0 ที่ต้องทำก่อน

### A. หน้าอุปกรณ์ขัดข้อง: แยก error, empty และ no results

หลักฐาน: [DownDevices.jsx](src/components/DownDevices.jsx) `fetchDownDevices` ล้าง devices เป็น[] เมื่อ success=false หรือ catch ส่วน render ใช้ filteredDevices.length===0 แล้วแสดง “ไม่มีอุปกรณ์ที่ขัดข้องในขณะนี้” ทั้งกรณี API ล้มเหลวและคำค้นไม่ตรง

งานแก้:

- ตรวจ response.ok/shape และแยก initial error พร้อม retry; refresh error เก็บรายการเดิมและแสดงเวลา/คำเตือนข้อมูลเก่า
- เมื่อ devices มีแต่ค้นหาไม่พบ ให้ “ไม่พบอุปกรณ์ตามคำค้น” พร้อมล้างคำค้น ไม่แสดงว่าสถานะเครือข่ายปกติ
- แสดง count ที่พบ/ทั้งหมดและ checked_at จริง; packet loss null แสดง — ไม่แสดง `-%`
- polling60วินาทีต้องไม่ซ้อนคำขอ มี abort/timeout และพักเมื่อแท็บซ่อน; manual refresh ไม่ reset filter/focus
- ใช้ลิงก์ชื่อแทนให้คลิกได้เฉพาะ tr; เพิ่ม label ช่องค้นหา filled highlight และปุ่มรีเฟรชชื่อชัด/44px
- ตาราง desktop บรรทัดเดียวและเลื่อนเฉพาะกรอบ; mobile อ่านชื่อ/IP/เวลาตรวจครบพร้อมปุ่มดูรายละเอียด

**API:** ใช้ `/api/latency/down` เดิม ไม่ต้องเพิ่ม endpoint สำหรับการแก้ข้างต้น

### B. หน้ารายละเอียดอุปกรณ์เครือข่าย: ไม่อนุมานสถานะจากค่าที่หาย

หลักฐาน: [DeviceDetails.jsx](src/components/DeviceDetails.jsx) การ normalize currentStats ใช้เงื่อนไข `latency_ms !== null || latency !== null` ซึ่ง undefined!==null เป็น true จึงมีทางแสดงออนไลน์ทั้งที่ไม่มีข้อมูลยืนยัน รวมถึง fallback หลายจุดที่ต้องแยกจากสถานะสด

งานแก้:

- สร้าง mapping explicit up/down/unknown; ค่าตัวเลขต้อง finite และต้องมีนิยามชัดว่าพิสูจน์สถานะได้ ไม่ใช้การมี/ไม่มี field แทน alive โดยเดา
- แยกผลตรวจล่าสุด ผลตรวจเมื่อผู้ใช้กด และประวัติ; แสดง source/checked_at/stale ให้ตรงกับข้อมูล
- ไม่ใส่0ให้ latency/packet loss ที่ไม่มีค่า; ไม่เปลี่ยน unknown เป็น offline โดยไม่มีหลักฐาน
- ย้าย `alert('Scan failed...')` เป็น inline error พร้อม retry รักษาผลเดิมและสิทธิ์การสั่ง scan
- เก็บหน้ากราฟ/ประวัติ downtime/ผล scan ให้ครบ ไม่มีการสั่ง scan เพื่อทดสอบ layout โดยไม่จำเป็น

**API:** เริ่มจาก normalization ใน frontend; ถ้า source/alive/timestamp ไม่ชัดให้ยืนยัน contract ของ endpoint เดิมก่อน ขอ field เพิ่มเฉพาะที่จำเป็น ไม่สร้างตัวเลขขึ้นมา

### C. หน้าจัดการงบประมาณ: อย่าค้นหาเพียง15รายการแรก

หลักฐาน: [BudgetManagement.jsx](src/components/BudgetManagement.jsx) `fetchTransactions` เรียก GET `/api/budgets/transactions` ไม่มี page/filter แล้ว `setTransactions(result.data)` ก่อน filter/sort/slice ใน browser โดยไม่ใช้ pagination จาก API

ผลตรวจอ่านจริงวันที่27กันยายน2026: request แบบเดียวกันคืน data array **15รายการ** แต่ pagination.total_items=**6,178**, total_pages=412 จำนวนจริงเปลี่ยนได้ตามข้อมูล จึงเป็นปัญหาขอบเขตข้อมูล ไม่ใช่เพียงหน้าตาตาราง

งานแก้:

- เปลี่ยนธุรกรรมเป็น server pagination/filter/sort ตาม contract จริง แสดง total จาก backend ไม่ใช่ data.length
- ตรวจ mapping field ของรายการที่ตารางเดิมใช้ เช่น value_co_curr/description/cost_center กับ contract ปัจจุบัน ไม่สรุปว่านำ shape ใหม่ไปใช้ได้โดยตรง
- ยืนยัน API รองรับ search field ที่ต้องการจริง ก่อนส่ง q แล้วถือว่าถูกกรอง; หากยังไม่รองรับให้แจ้ง backend ไม่กรองเฉพาะหน้าแล้วแสดงผลเหมือนค้นหาทั้งระบบ
- reuse query adapter/ตัวเลขเงินจากกลุ่ม budget เมื่อ semantics ตรงกัน แต่ไม่ย้ายสิทธิ์แก้ไข/นำเข้าไปหน้า public dashboard
- คง CRUD งบ การนำเข้า ผลตรวจไฟล์/แถวผิดพลาด และสิทธิ์เดิม ไม่เปลี่ยน API เขียนด้วยเหตุผลแค่ refactor UI
- หลังความครบถูกต้องแล้วปรับยอดเงิน/สี allocated/spent/remaining ให้ตรง dashboard พร้อมข้อความเกินงบและตัวเลขชิดขวา

**API:** endpoint pagination มีแล้ว แต่ต้องยืนยัน search/sort/field mapping; ถ้าขาดขอขยาย endpoint เดิมก่อน implement ส่วนที่อาศัยความสามารถนั้น

## 4. งาน P1 รายกลุ่ม

### 4.1 คลังอุปกรณ์และประวัติยืม

ไฟล์: [StockManagement.jsx](src/components/StockManagement.jsx), [EquipmentLoanHistory.jsx](src/components/EquipmentLoanHistory.jsx)

ข้อค้นพบ:

- Stock มี sessionStorage สำหรับแท็บ/คำค้น/status/selected IDs แล้ว ไม่ควรถอดออก; หลาย read/write ยังไม่ครอบ try/catch ทั้งหมด จึงเสี่ยงเมื่อ storage ใช้ไม่ได้
- ตาราง Stock ใช้ fixed widths หลายคอลัมน์และ tr onClick, ปุ่มไอคอนขนาดเล็กและ modal print/delete ของตัวเอง
- EquipmentLoanHistory มี debounce400ms และ API pagination แล้ว แต่ search/filter/page อยู่ใน state เริ่มใหม่; fetch catch ลง console ไม่มี persistent error state
- ประวัติยืม grouping batch จากรายการในหน้าเดียว อาจเป็นเพียงส่วนหนึ่งของ batch เมื่อถูกแบ่งข้ามหน้า ต้องไม่กล่าวว่ากลุ่มนี้ครบทุกชิ้น

งานแก้:

- ใช้ header/toolbar/footer/control ร่วมกับ EquipmentSearch; status filter สูงเท่า input และ label ไม่พึ่ง placeholder
- คงการเลือกหลายรายการข้ามหน้า แสดง “เลือกไว้ N รายการ” + “ล้างที่เลือก” ระบุ select all หมายถึงหน้านี้หรือผลทั้งหมด พร้อม mixed checkbox state
- ก่อนพิมพ์ QR ตรวจขอบเขต selected IDs และรายการที่ถูกลบ/สิทธิ์เปลี่ยน แสดงรายการที่ทำได้/ทำไม่ได้ ไม่ตัดทิ้งเงียบ ๆ
- ใช้ลิงก์ชื่อและปุ่มคำสั่งจริง แยก checkbox จากการเปิดรายละเอียด ไม่ให้แตะคืน/QR แล้วเปิดรายละเอียดพร้อมกัน
- ประวัติยืมใช้สถานะ “ยังไม่คืน/คืนแล้ว” และวันที่/ผู้ยืมอ่านง่าย คงสิทธิ์คืนตามผู้ใช้และ fallback login กลับหน้าที่มา
- เพิ่ม inline error/retry/stale และ abort คำค้นเก่า; จำเงื่อนไข/page กลับจาก login/รายละเอียดโดยไม่จำ token เพิ่ม
- ถ้า batch ข้ามหน้าให้แจ้ง “รายการในหน้านี้” หรือขอ batch detail เฉพาะเมื่อจำเป็นต้องทำงานทั้งชุด ไม่เปลี่ยนกติกาการคืนเอง

### 4.2 จัดการอุปกรณ์เครือข่ายและประวัติทดสอบ

ไฟล์: [NetworkDeviceManagement.jsx](src/components/NetworkDeviceManagement.jsx), ส่วนประวัติใน [Management.jsx](src/components/Management.jsx)

ข้อค้นพบ: toolbar/input/select inline outline:none, ฟอร์ม auto-fit minmax250px, ตารางเดิม; NetworkDeviceManagement มี session persistence แล้วแต่ไม่ควรถือว่าทุกค่า/หน้า/scroll ถูกเก็บครบ ส่วนประวัติ Speed Test มีปุ่ม pagination สี `#0f172a` ตายตัว

งานแก้:

- ย้ายรายการไป ListPage, labels/focus/filled state, sort button + aria-sort, ellipsis/ข้อมูลเต็ม และ pagination44px
- จัดแบบฟอร์มเพิ่ม/แก้เครือข่ายเป็นหมวดข้อมูลสำนักงาน/เครือข่าย/ตำแหน่ง ไม่เอา schema อุปกรณ์สำนักงานมาใช้แทนเพราะเป็นข้อมูลคนละชนิด
- คง export และสิทธิ์สร้าง/แก้/ลบ ตรวจขอบเขต export จาก implementation ก่อนเปลี่ยน label
- ประวัติทดสอบแสดง Download/Upload หน่วยเดียวกับ Analytics และบอก Latency วัดแบบใดตาม contract ห้ามเรียก HTTP time เป็น ICMP โดยอัตโนมัติ
- ย้ายสี pagination/status ไป tokens รองรับ light/dark; ทำ mobile cards หรือ local table scroll ตามปริมาณคอลัมน์
- ใน App กลไกกลับจาก device ปัจจุบันมีเงื่อนไข map/downtime โดยเฉพาะ ให้ตรวจต้นทางอื่นทั้งหมดและส่ง return context จาก management/down-devices/devices อย่างถูกต้อง

### 4.3 จัดการงานและธุรกรรมในงาน

ไฟล์: [JobManagement.jsx](src/components/JobManagement.jsx), [BudgetTransactionPicker.jsx](src/components/BudgetTransactionPicker.jsx), [EquipmentPicker.jsx](src/components/EquipmentPicker.jsx)

ข้อค้นพบ: ตารางงานและธุรกรรมใช้ th onClick, สีพื้น/เส้นบางส่วนตายตัว, fixed columns และ dialog preview/ดำเนินงานหลายชุด ขณะที่ JobFormModal/JobReportDetails มี modal accessibility อยู่บางส่วนแล้ว

งานแก้:

- ใช้มาตรฐานรายการเดียวกับ JobReport แต่คงงานของผู้จัดการ: เพิ่ม/แก้ไข เริ่มงาน/อัปเดต/ปิด/ยกเลิก/แนบไฟล์/เชื่อมธุรกรรมและประวัติ
- เปลี่ยนหัว sort เป็น button มี aria-sort; row link จริง พร้อมชื่อ/รายละเอียดบรรทัดเดียวและหน้าข้อมูลเต็มสำหรับ touch
- แยก “ข้อมูลรายการงาน”, “ข้อมูลการเงินที่ผูกงาน”, “การเปลี่ยนสถานะงาน” ให้รู้ว่าปุ่มใดมีผลอะไร ไม่ทำปุ่มทุกอันเป็น primary
- modal พรีวิวเอกสาร/รูปต้องมีชื่อ focus และ Escape; Escape ที่มีอยู่ใน lightbox ไม่เท่ากับ modal ทุกตัวเข้าถึงได้ครบ
- Picker ต้องมี loading/empty/error แยก คำค้นครอบคลุมตาม contract และแสดงรายการที่เลือกคงอยู่เมื่อเปลี่ยนหน้า/ค้นหา
- BudgetTransactionPicker ใช้ `POST /transactions/find` เดิมอยู่ ไม่สลับเป็น endpointใหม่จน mapping/pagination/สิทธิ์ตรงกัน; ไม่ลดความสามารถค้นหา/เลือกหลายรายการ
- ใช้ validation/permission ของงานเดิม ไม่รวม action flow ของ public report กับ admin โดยเหมารวม

### 4.4 ตั้งค่าผู้ใช้และสำนักงาน

ไฟล์: [AdminSettings.jsx](src/components/AdminSettings.jsx)

ข้อค้นพบ: ตาราง users และ locations, grid minmax300px, search minWidth250px, label “Admin Settings/User Management/Locations/Edit User Profile”, pagination มีสีข้อความตายตัว และ modal edit/delete ใช้ markupเฉพาะหน้า

งานแก้:

- แยกหัวหน้ารายการผู้ใช้/สำนักงาน พร้อมคำไทยและคำอธิบายสิทธิ์ที่จำเป็น; controls44px และ actions อยู่ตำแหน่งเดียวกับหน้าจัดการอื่น
- รายละเอียดผู้ใช้/สำนักงานจัดสองคอลัมน์บน desktop หนึ่งคอลัมน์บน mobile ตามพื้นที่จริง ป้องกัน grid+padding ดันจอ360px
- ใช้ labeled form, inline field errors, dirty guard และปุ่ม cancel/save ตามมาตรฐาน
- ปุ่มเปลี่ยนสิทธิ์/ลบต้องระบุเป้าหมายและผลกระทบ ยืนยันลบและป้องกันกดซ้ำ คง role policy ทั้ง frontend/backend
- ทดสอบ401/403 และ API error ด้วย mock หรือบัญชีทดสอบ ห้ามแก้ผู้ใช้จริงเพียงเพื่อทดสอบ UI

### 4.5 Modal กลางที่ยังต่างจากมาตรฐาน

กลุ่มที่พบ markup overlay/div และยังไม่พบ dialog semantics/focus helper ในไฟล์:

- [BorrowReturnModal.jsx](src/components/BorrowReturnModal.jsx): ฟอร์มแคบ380px และ input outline:none; ปรับ field errors/submit state/dirty close โดยคง borrow/return rules
- [LoanHistoryModal.jsx](src/components/LoanHistoryModal.jsx), [OwnerHistoryModal.jsx](src/components/OwnerHistoryModal.jsx), [JobHistoryModal.jsx](src/components/JobHistoryModal.jsx): กว้าง440–520px, close icon และ backdrop close; แยก fetch error จากประวัติว่างและจัด timeline/table ให้เหมาะกับ desktop
- [QrCodeModal.jsx](src/components/QrCodeModal.jsx): กว้าง340pxเหมาะกับเนื้อหาได้ ไม่จำเป็นต้องขยายทุก modal; เติมชื่อ dialog/focus/close44px และ image error/loading
- print/delete dialogs ใน Stock, BudgetManagement, NetworkDeviceManagement, AdminSettings และ modal เปลี่ยนสถานะใน JobManagement ต้องตรวจชุดเดียวกัน

ให้พิจารณาต่อยอด hook/ConfirmDialog ที่เพิ่งเพิ่มใน `equipment-form` และ helper ของ JobFormModal/JobReportDetails ก่อนสร้างอีกชุด ตรวจ nested dialog/focus return จริง และสกัด common dialog เฉพาะส่วนที่ใช้ร่วมกันได้ ห้ามเปลี่ยนทุก modal เป็นแบบเดียวจนเสีย flow/การยืนยันเดิม

## 5. งาน P2 และการตรวจหน้าที่ปรับแล้ว

### Navigation และหน้าที่ไม่มีตาราง

- Management overview/network: การ์ด div onClick ให้เปลี่ยนเป็น link ที่รองรับ keyboard/เปิดแท็บใหม่; ไม่ซ้อน button ใน link และไม่สร้าง nested interactive controls
- Auth: label username/password ในโค้ดยังไม่ผูก id/htmlFor และ input outline:none ให้ผูก label เพิ่ม autocomplete ที่เหมาะสมและ focus ที่มองเห็น คง SSO/local login/return path เดิม ไม่เก็บ password เพื่อ filled state หรือ restore
- SsoCallback: ตรวจ loading/error/retry/back แบบไม่ทำให้ loginวนซ้ำ และไม่แสดงรายละเอียด token ใน UI
- About: ใช้ชื่อ NE2 LDAP และไทยสม่ำเสมอ คู่มือทั้งหน้า/USER_GUIDE ต้องอัปเดตตาม implementation จริง ไม่ถือว่าแผนที่ยังไม่ทำเป็นฟีเจอร์ที่มีแล้ว

### หน้าที่ใช้มาตรฐานแล้ว: เก็บเฉพาะช่องว่าง

| กลุ่ม | สิ่งที่ตรวจต่อ |
|---|---|
| Devices, EquipmentSearch, EquipmentBorrow | มี caption/scope/ListPage แล้ว คงไว้; ตรวจคืน scroll/focus หลังเปิดรายละเอียด ปุ่มicon/filled state และ modal ที่ยังใช้ของเดิม |
| SitesMap, NetworkOverview/AttentionList | คง filters/แผนที่/list/fullscreen/drill-down; ตรวจข้อมูล unknown/stale และลิงก์สรุป ไม่ทำแผน redesign ซ้ำโดยไม่มีเหตุ |
| Analytics | คง cancel/phase/result persistence; ตรวจ error/live region/reduced motion และจอแคบตามแผนเดิม |
| DowntimeHistory | ตารางรายการและตารางข้อมูลกราฟยังไม่มี caption/scopeครบใน source; เพิ่มโดยไม่เปลี่ยน snapshot/drill-down; “ล้างตัวกรอง” ปัจจุบันเรียก defaults ซึ่ง reset sort ด้วย ให้ทำตามมาตรฐานข้อ7หรือระบุชัดว่า resetทั้งมุมมอง |
| BudgetDashboard | มี caption/scope/sort buttons แล้ว; ตรวจตัวกรอง สีเงิน และ chart keyboardต่อ ห้ามลด drill-down ที่ทำแล้ว |
| EquipmentDetails | ตรวจปุ่ม QR print/รูป/media และ modal history/borrowร่วม ไม่ต้องรื้อ layout ที่ทำแล้ว |
| JobReport/JobReportDetails/JobFormModal | คง accessible modal helper ที่มีแล้ว ตรวจ picker/history ที่อยู่ภายในและความสอดคล้องของชื่อสถานะ |
| OfficeSiteEquipment/EquipmentForm | มี implementation ใหม่ใน working tree ให้ตรวจตาม COMPUTER_MANAGEMENT_SHARED_FORM_PLAN.md; wrapperรายชื่อสำนักงานยังเป็นงานเก็บรายละเอียดแยก |

inline styles ที่เหลือไม่ต้องถูกย้ายทุกบรรทัดเพื่อให้ผ่านเป้าหมาย ให้แก้เมื่อกระทบ tokens/layout/การดูแลพฤติกรรมร่วมจริง

## 6. มาตรฐานร่วมที่จะนำไปใช้ในแต่ละชุดงาน

1. **ตาราง:** captionหรือaccessible name, scope=col, sort button+aria-sort, heading alignment ตรง cell, numeric tabular-nums, name ellipsisหนึ่งบรรทัด ไม่มีunderline และมีทางอ่านครบผ่านรายละเอียดบนtouch
2. **Responsive:** desktop table + mobile card/local horizontal scroll ที่มีชื่อและเข้าถึงด้วยkeyboard; ไม่ซ่อนคอลัมน์สำคัญโดยไม่มีทางอ่าน และไม่บีบฟอนต์เพื่อให้ทุกคอลัมน์อยู่จอมือถือ
3. **ฟอร์ม:** label, required, field error/aria-describedby, input/select/comboboxสูงเท่ากันอย่างน้อย44px; control8px/panel16px; cancelก่อนsaveในreading order และ cancelไม่ใช้dangerโดยไม่มีเหตุ
4. **สี/ภาษา:** semantic tokens light/dark, ข้อความประกอบสถานะ, ภาษาไทยสำหรับคำสั่ง หน่วยและขอบเขตเวลาชัด ไม่ใช้0แทนmissing
5. **บริบท:** URL/sessionตามflow ไม่ลบsessionStorageเพียงเพื่อ refactor; validate/fallbackเมื่อstorageเสีย, preservefilter/page/sort/selection/scrollตามงาน แยกหรือล้างข้อมูลที่ขึ้นกับบัญชี
6. **ข้อมูล:** initial loading/error/empty/no-results/staleแยก, response.ok/shape, abort/race protection, pollingไม่ซ้อน; อย่าใช้toastอย่างเดียวเมื่อผู้ใช้ต้องแก้ไขเพื่อไปต่อ
7. **Export/งานกลุ่ม:** ระบุ scopeจริง (ทั้งสำนักงาน/ผลค้นหา/ที่เลือก/หน้าปัจจุบัน) และคงสิทธิ์เดิม; “ปรับUI” ไม่ใช่เหตุเปลี่ยนขอบเขตข้อมูล
8. **Modal:** named dialog/aria-modal, initial focus/trap/return, Escapeตามpending/dirty state, ขนาดตามเนื้อหา มีscroll และไม่ทับkeyboardมือถือ

ไม่สร้าง DataTable abstraction ขนาดใหญ่ก่อนรู้ข้อแตกต่างของอย่างน้อยสองหน้า ใช้ ListPage.css/controlsร่วมก่อน แล้วสกัด SortHeader, DataState, Pagination หรือ Dialog เมื่อช่วยลดพฤติกรรมซ้ำจริง

## 7. API ที่ต้องคุยก่อนดำเนินการ

รายละเอียดสำหรับส่งทีม backend: [REMAINING_UX_UI_BACKEND_API_SPEC.md](REMAINING_UX_UI_BACKEND_API_SPEC.md) ระบุ endpoint, parameters, response, compatibility และเกณฑ์ทดสอบ โดยแยกงานที่ต้องขยาย API เดิมออกจาก API ใหม่ที่เป็นทางเลือก

| ประเด็น | ใช้เดิมได้ / ต้องยืนยัน |
|---|---|
| DownDevices error/layout | ใช้ API เดิมได้ทันที |
| DeviceDetails status | ยืนยัน canonical status/alive/timestamp ของแต่ละ source; ถ้าขาดค่อยขอ fieldเพิ่ม |
| BudgetManagement transactions | ใช้ server pagination ที่มีแล้ว ยืนยัน q/search/sort/field mapping ก่อน; ขอขยายเดิมเมื่อขาด ห้ามสมมติว่า filterทำงาน |
| LoanHistory batch | APIเดิมพอสำหรับรายการแบบแบ่งหน้า; ถ้าต้องแสดงทั้งbatch/คืนทั้งbatch ต้องยืนยัน contractหรือเสนอเพิ่มก่อน |
| Management/Stock exports | ตรวจ completeness/max limit; ถ้าข้อมูลมากจน client exportไม่ไหว ค่อยเสนอ export job/server endpoint โดยคงสิทธิ์และscopeเดิม |
| Modal/focus/responsive/ภาษา | ไม่ต้องมีAPIใหม่ |
| ฟอร์มอุปกรณ์ร่วม/ข้อมูลวงสำนักงาน | ใช้ข้อเสนอAPIในแผนเฉพาะที่มีอยู่ ไม่ขอซ้ำในเอกสารนี้ |

ยังไม่เพิ่ม endpoint หรือเปลี่ยน backend ในงานตรวจนี้ ทุกข้อที่ต้องใช้ capability ใหม่ต้องแจ้งและตกลงก่อนทำส่วนที่พึ่งพา

## 8. ลำดับพัฒนาและเกณฑ์จบแต่ละชุด

### ชุด1 — ความหมายและความครบของข้อมูล

DownDevices, DeviceDetails normalization, BudgetManagement pagination/search

จบเมื่อ API error ไม่แสดงระบบปกติ, unknown ไม่เป็นonline, และรายการธุรกรรมใช้ยอด/ค้นหา/เรียงทั้งชุดตามcontract โดยคงactionเดิม

### ชุด2 — ส่วนร่วมที่กระทบหลายหน้า

modal borrow/history/QR และรูปแบบ error/sort/pagination ร่วม ทำทีละcomponentพร้อมตรวจ callersจริง ไม่เปลี่ยนpropsจนหน้าที่เรียกพัง

จบเมื่อ keyboard/focus/Escape/backdrop/submit state ผ่านทั้งหน้าค้นหา รายละเอียด คลัง และประวัติ

### ชุด3 — หน้ารายการใช้งานประจำ

Stock, EquipmentLoanHistory, NetworkDeviceManagement และประวัติSpeed Test

จบเมื่อ desktop/mobile/table/card/selection/exportและreturn contextครบ โดยไม่มีfeatureหาย

### ชุด4 — หน้าจัดการและworkflowซับซ้อน

JobManagement/pickers, BudgetManagement UI/import และ AdminSettings

จบเมื่อผู้ใช้ทำงานครบflowตามสิทธิ์ บันทึกล้มเหลวไม่เสียdraft และ error/confirmationมีข้อมูลพอให้ตัดสินใจ

### ชุด5 — เก็บมาตรฐานทั้งระบบ

navigation/login/about, รายชื่อสำนักงาน และsemantics/regressionของหน้าที่ปรับแล้ว พร้อมอัปเดตDESIGN_STANDARDSและคู่มือเฉพาะพฤติกรรมที่เปลี่ยนจริง

ไม่กำหนดวันเสร็จก่อนยืนยันcontractและขอบเขตงานฟอร์มที่กำลังแก้ แต่ละชุดควรแยกcommit/PRตามflowเพื่อreviewและย้อนกลับได้

## 9. Checklist ตรวจรับร่วม

- [ ] มีหลักฐานก่อน/หลังสำหรับdesktop1280/1440 และmobile360/390 พร้อมtablet768, sidebarเปิด/ปิด, light/dark, ข้อความยาวและzoom200%
- [ ] Tab/Enter/Space/Escape ใช้งานหลักได้ focusไม่หาย ไม่ติดในmodal และชื่อปุ่มไม่พึ่งtitleอย่างเดียว
- [ ] ตารางไม่มีrowสูงผิดปกติจากชื่อยาว หัวคอลัมน์ตรงค่าและอ่านข้อมูลเต็มบนtouchได้
- [ ] ตรวจloading/empty/no-results/error/stale/permission/timeoutและresponseสลับลำดับ โดยไม่แก้ข้อมูลproductionเพื่อทดสอบ
- [ ] ค้นหา → รายละเอียด/แก้ไข → Back ทั้งปุ่มแอป/browser และreloadคงบริบทตามที่ออกแบบ
- [ ] storageใช้ไม่ได้/ค่าที่เก็บผิดรูปแบบ/ข้อมูลลดลง/หน้าที่จำไว้เกินขอบ ไม่ทำหน้าเสียหรือค้างหน้าว่าง
- [ ] pagination/search/sortรวมข้อมูลครบตามAPI และbatch/export/selectionไม่เปลี่ยนความหมายเดิม
- [ ] destructive actions/permission/loan rules/การนำเข้า/เอกสาร/QRยังทำงานครบ
- [ ] lint/build และtestsเฉพาะพฤติกรรมเสี่ยงผ่าน ระบุbaselineปัญหาเดิมแยกจากปัญหาที่เพิ่มใหม่
- [ ] อัปเดต USER_GUIDE.md และAboutเมื่อflowเปลี่ยน พร้อมบันทึกส่วนที่ยังไม่ได้ทดสอบ ไม่ถือว่าผ่านเพราะเปลี่ยนclassมาเป็นListPageแล้ว
