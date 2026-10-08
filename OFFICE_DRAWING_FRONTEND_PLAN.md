# แผนพัฒนา Frontend — เมนู “สำนักงาน” และเครื่องมือวาดผัง

วันที่: 7 ตุลาคม 2569

อ้างอิง: `OFFICE_DRAWING_API.md` และ `OFFICE_DRAWING_BACKEND_API_REQUEST.md`

สถานะ: แผน implementation ตาม API ที่ backend ส่งมอบ ยังไม่ได้พัฒนา editor หรือทดสอบ integration จากการจัดทำแผนนี้

## 1. เป้าหมายและขอบเขต

ผู้ใช้เลือกสำนักงาน สร้าง/เปิดแบบ วาดผังง่าย ๆ และบันทึกกลับมาแก้ต่อได้ รองรับทั้งผังห้องและแนวเดินสายระหว่างอาคารให้จัดหน้าใกล้ภาพตัวอย่าง: อาคาร เส้นสายหักมุม จุดอุปกรณ์ Outlet คำอธิบายสัญลักษณ์ และกรอบชื่อแบบ

รุ่นแรกมีการดู/สร้าง/แก้ไข/ทำสำเนา/ลบแบบ, วาดและจัดวางวัตถุ, ผูกทะเบียนอุปกรณ์, Undo/Redo, layers, legend, title block และพิมพ์ A4/A3 ผ่าน browser

ไม่รวม CAD/3D/DWG, การแก้แบบร่วมกันแบบ real-time, BOQ อัตโนมัติ, การคำนวณระยะสายจริงจากภาพ และการแปลง PDF เป็นวัตถุแก้ไขได้ การนำภาพหรือ PDF มาเป็นพื้นหลังเป็น phase ถัดไปเพราะ schema ปัจจุบันไม่รองรับไฟล์แนบ

## 2. สิทธิ์ที่ยืนยันแล้ว

| การทำงาน | ผู้ไม่ login / role อื่น | super_admin / network_admin / computer_admin |
|---|---|---|
| เลือกสำนักงาน ดูรายการ/รายละเอียดแบบ ซูม เลื่อน พิมพ์ | ได้ | ได้ |
| สร้าง/ทำสำเนา/แก้ไข/ลบแบบ | ไม่ได้ | ได้ทุกสำนักงาน |
| ค้นทะเบียนเพื่อผูกวัตถุ (`equipment-options`) | ไม่ได้ | ได้ |

- เมนู “สำนักงาน” แสดงให้ทุกคนเห็น
- ใช้ permissions จาก API เพื่อเปิดเครื่องมือ และตรวจ role/session ฝั่ง UI ประกอบ; server เป็นผู้ตัดสินสิทธิ์จริง
- โหมดอ่านไม่มีเครื่องมือเปลี่ยน document แต่เลือกวัตถุเพื่อดูข้อมูลและเลื่อน/ซูมได้
- การ lock layer เป็นการป้องกันแก้โดยไม่ตั้งใจใน editor ไม่ใช่สิทธิ์ความปลอดภัย
- Schema version ที่ UI ไม่รองรับต้องไม่บันทึกทับหรือทิ้งวัตถุที่ไม่รู้จัก แสดงข้อจำกัดการเปิดแบบอย่างชัดเจน

## 3. หน้าและการนำทาง

เพิ่มในระบบ path/history เดิมของ App และ Sidebar โดยไม่เพิ่ม router library เพียงเพื่องานนี้

| Path | หน้า |
|---|---|
| `/offices` | รายชื่อสำนักงาน ค้นชื่อ/จังหวัด แสดงจำนวนแบบ |
| `/offices/:siteId/drawings` | รายการแบบของสำนักงาน ค้นหา/ชนิดแบบ/sort/pagination |
| `/offices/:siteId/drawings/new` | เลือกแม่แบบและสร้างแบบ |
| `/offices/:siteId/drawings/:id` | เปิดผังในโหมดอ่านหรือแก้ไขตามสิทธิ์ |

- ใช้ selectors ของ drawing API ให้รวมสำนักงานที่ไม่มี monitored network device
- รองรับสำนักงานไม่มีแบบ, ไม่พบแบบ, แบบถูกลบ และ siteId ใน URL ไม่ตรงกับแบบที่โหลด
- เมื่อเปิดแบบให้ตรวจ pea_site_id จาก API ไม่อ้างว่าแบบเป็นของสำนักงานใน URL หากไม่ตรง; นำทางไป path ที่ถูกต้อง
- เก็บ search/type/page/sort ของรายการใน URL เพื่อ Back/Forward และแชร์ลิงก์ได้
- ใช้ dirty-navigation guard เดิมเมื่อออกจาก editor รวม sidebar, Back/Forward, refresh และปิดแท็บตามที่ browser รองรับ

## 4. Layout ของ editor

### แถบบน

ชื่อสำนักงาน/แบบ, breadcrumb กลับรายการ, สถานะมีการแก้ไข/กำลังบันทึก/บันทึกล่าสุด, Undo/Redo, บันทึก, ดูตัวอย่างพิมพ์ และเมนูจัดการแบบ

### แถบซ้าย

เลือกวัตถุ, เลื่อนผัง, อาคาร/ห้อง, ผนัง, ประตู/หน้าต่าง, โต๊ะ, อุปกรณ์, Outlet, จุดต่อสาย, แนวสาย และข้อความ แยกกลุ่มเครื่องมือให้ค้นง่าย พร้อมคลังสัญลักษณ์

### พื้นที่กลาง

กระดาษสีขาวบนพื้นหลังเทา มี grid ที่เปิด/ปิดได้, zoom, fit page, เลื่อนพื้นที่ และจุดจับของวัตถุที่เลือก โหมดอ่านไม่แสดงจุดจับแก้ไข

### แผงขวา

- เมื่อเลือกวัตถุ: ชื่อ ขนาด ตำแหน่ง มุมหมุน สี/เส้น ชนิดสัญลักษณ์ และข้อมูลทะเบียนที่ผูก
- เมื่อไม่เลือก: กระดาษ ชื่อแบบ อาคาร/ชั้น legend และ title block
- จัดการ layers: เลือกชั้นที่ใช้งาน ซ่อน ล็อก เรียงลำดับ และย้ายวัตถุระหว่างชั้น
- Mobile/tablet ใช้แผงเปิดปิดได้เพื่อไม่บังพื้นที่วาด; การดูและพิมพ์รองรับจอเล็ก ส่วนการวาดละเอียดเหมาะกับ desktop/tablet

## 5. แนวทาง renderer และ document model

เสนอใช้ React + SVG สำหรับ editor/preview ในรุ่นแรก เพราะวัตถุเป็นรูปทรงและเส้น 2 มิติ และต้องพิมพ์แบบ vector ใช้ pointer events สำหรับลากและวาด โดยไม่เก็บ DOM หรือ library-specific state ลง API

ก่อนสร้าง editor เต็มให้ทำ prototype กับ fixture และแบบขนาดใกล้เพดาน เพื่อวัดการตอบสนอง หาก SVG ไม่เหมาะกับปริมาณวัตถุจริงให้ปรับ renderer โดยคง document schema เดิม

- Canonical document ใช้ schema v1 จาก backend
- พิกัด mm บนกระดาษ มุมซ้ายบน, x ไปขวา/y ลงล่าง
- แยก screen coordinates ออกจาก document coordinates; แปลงผ่าน SVG transform ก่อนแก้ค่า
- Box หมุนตามเข็มนาฬิการอบจุดกึ่งกลาง; polyline ใช้พิกัดกระดาษ
- IDs สร้างด้วยรูปแบบที่ backend รับและคงเดิมเมื่อแก้; การ duplicate สร้าง IDs ใหม่และ remap references ภายในชุดที่คัดลอก
- ไม่บันทึก zoom/pan/selection/undo stack หรือ preview ที่กำลังลากลง document
- วัตถุที่ถูกซ่อนด้วย layer ยังอยู่ใน document แต่ไม่ปรากฏในภาพ/งานพิมพ์
- ไม่ใส่ field ใหม่ที่ schema ไม่รองรับลง payload
- สี/ความหนา/align defaults อยู่ในฟังก์ชันกลางและต้องตรง backend; คงความต่างระหว่าง omitted/null ตาม contract ที่ยืนยัน
- กำหนด rendering order ชั่วคราวเป็น layer order แล้ว object order ภายใน layer รอ backend ยืนยันก่อนตรวจรับ

## 6. เครื่องมือวาดและพฤติกรรม

| เครื่องมือ | พฤติกรรมรุ่นแรก |
|---|---|
| เลือก/ย้าย | คลิกเลือก, ลากย้าย, Shift เลือกเพิ่ม, Escape ยกเลิกการกระทำ |
| อาคาร/ห้อง/โต๊ะ | ลากสร้างสี่เหลี่ยม ปรับขนาดและหมุนจากจุดจับหรือแผงคุณสมบัติ |
| ผนัง | คลิกต่อจุด polyline, Enter/double-click จบ, Escape ยกเลิก; กำหนดความหนา |
| ประตู/หน้าต่าง | วาง/หมุน/ปรับขนาด; ประตูเลือก hinge/swing พร้อมเส้นโค้งทิศเปิด |
| อุปกรณ์/Outlet/junction | เลือกสัญลักษณ์แล้วคลิกวาง พร้อม label |
| แนวสาย | คลิกเพิ่มจุดหักมุม, ย้าย/เพิ่ม/ลบจุด, เลือก Fiber/UTP/planned/power/other |
| ข้อความ | คลิกวาง แก้ plain text ขนาดและแนวจัดข้อความ |
| Grid/snap | Snap ตามระยะ mm และล็อกแนวนอน/แนวตั้งระหว่างวาดตามปุ่มช่วย |

- ให้ pointer capture ระหว่างลาก และคืนสถานะเดิมเมื่อ pointercancel/Escape
- ไม่ใช้ shortcut ลบ/Undo ของ editor ขณะกำลังพิมพ์ใน input/textarea
- Drag หนึ่งครั้งเป็นหนึ่ง history command ไม่สร้าง undo entry ทุก pointermove
- การแก้คุณสมบัติรวมเป็น action ตามจังหวะจบการแก้ ไม่บันทึกลง server ทุกตัวอักษร
- Pan/zoom/selection ไม่เพิ่ม undo history และไม่ทำให้ document dirty
- ลบ layer ที่มีวัตถุต้องให้เลือกย้ายวัตถุหรือยืนยันลบพร้อมกัน ไม่ทิ้ง layer_id อ้างชั้นที่ไม่มี
- การขยับ/ปรับขนาด/หมุน box ที่สายผูกอยู่ต้องคำนวณ anchor ใหม่และอัปเดตปลาย points ใน action เดียวกัน โดยคงจุดหักมุมอื่น
- ลบ box ที่มีสายอ้างถึงให้เลือกคงสายโดยตั้ง start/end=null หรือเลือกสายแล้วลบด้วย ไม่ส่ง dangling reference
- ประตู/หน้าต่างรุ่นแรกเป็นวัตถุอิสระพร้อม snap ไม่คำนวณเจาะช่องผนังอัตโนมัติ
- measured_length_m เป็นค่าที่กรอกจากการสำรวจ ไม่คำนวณจากความยาว polyline ใน schematic

## 7. สัญลักษณ์ แม่แบบ Legend และกรอบชื่อแบบ

สร้างชุดสัญลักษณ์ SVG ภายในแอปตาม symbol_keys จาก capabilities ไม่รับ markup จาก document มารัน ใช้รูปแบบเส้นที่อ่านง่ายเมื่อพิมพ์ขาวดำและใช้ label ประกอบสี

แม่แบบเริ่มต้น:

1. กระดาษเปล่า เลือก A4/A3 แนวตั้ง/แนวนอน
2. ผังสำนักงานตัวอย่าง มีห้อง ผนัง ประตู หน้าต่าง โต๊ะ และจุดอุปกรณ์
3. ผังเดินสายระหว่างอาคาร มีกรอบอาคาร เส้น Fiber สีส้ม UTP สีฟ้า เส้นประ และ Outlet คล้ายตัวอย่างของผู้ใช้

ใช้ fixture backend เป็นข้อมูลทดสอบ แม่แบบที่ให้ผู้ใช้สร้างจริงต้องไม่มี ID ทะเบียน/ชื่อบุคคล/สำนักงานตัวอย่างติดมาผิดแห่ง ให้ผู้ใช้เลือกสำนักงานและเชื่อมทะเบียนเอง

- Legend เพิ่ม/ลบ/เรียงรายการและลากตำแหน่งได้ตาม schema; ไม่อ้างว่าเป็นจำนวนจุดจริง
- Title block แสดง project/drawing title/location/revision/date/prepared_by/checked_by/contact/sheet/logo
- Title block อยู่ล่างขวาตามกระดาษและ margin; แสดงขอบเขตพื้นที่เพื่อช่วยไม่ให้วัตถุทับกรอบ
- โลโก้ใช้ asset ที่ระบบมีอยู่ตาม logo_key
- ข้อความไทย wrap ในพื้นที่ที่กำหนดอย่างสม่ำเสมอทั้ง editor และหน้าพิมพ์
- Contract ปัจจุบันห้าม URL/markup ในข้อความ ให้ UI แสดง error ที่ตรง field ไม่ลบข้อความผู้ใช้เงียบ ๆ; ข้อเสนออนุญาต URL plain text ยังรอ backend ตอบ

## 8. การใช้ API

| งาน UI | API |
|---|---|
| เปิดเมนูสำนักงาน | GET selectors พร้อม search/page/limit |
| เตรียม renderer/editor | GET capabilities; โหลด/cache ตาม session และรุ่นที่รองรับ |
| รายการแบบ | GET / พร้อม pea_site_id และ filters รายการ |
| เปิดแบบ | GET /:id และ GET /:id/equipment-links |
| สร้าง/ทำสำเนา | POST / ด้วย writable fields เท่านั้น |
| บันทึก | PUT /:id พร้อม document ทั้งชุดและ expected_version |
| ลบ | DELETE /:id พร้อม expected_version ใน JSON body |
| เลือกทะเบียน | GET equipment-options เฉพาะผู้มีสิทธิ์แก้ไข |

Base path ทุกเส้นคือ `/api/office-drawings`

- ใช้ AbortController/timeout และ request key ป้องกัน response เก่าทับสำนักงาน/แบบ/session ใหม่
- Query allowlist แยกตาม endpoint, URL-encode และ debounce search
- ปฏิบัติตาม pagination จริงของ selectors ไม่ถือว่า limit=1000 หมายถึงครบเสมอ
- Public requests ไม่แนบ token เมื่อไม่มี session; เมื่อมี session แนบเพื่อรับ permissions ที่ถูกต้อง
- ตัวเลือกอุปกรณ์โหลดแบบ pagination ตามสำนักงาน ไม่โหลดทั้งทะเบียนหรือเรียกรายละเอียดทุกวัตถุทีละ request
- แบบที่มี link ย้าย/ลบยัง render ได้ แสดงสถานะจาก equipment-links ใน inspector โดยไม่เขียนทับ label บนผัง
- หาก resolve links ล้มเหลว ยังแสดงตัวผังได้พร้อมปุ่มลองใหม่ ไม่ถือว่าวัตถุทุกชิ้นถูกลบ

## 9. การบันทึก Draft, Undo และ version conflict

รุ่นแรกใช้ปุ่มบันทึกชัดเจน ไม่ autosave ไป server ทุกการเปลี่ยนแปลง

- แยก saved baseline, current draft และ history stack
- วัด dirty จาก document/metadata ที่บันทึกจริง ไม่รวม viewport
- บันทึก snapshot ของ draft ณ เวลากด save; ป้องกันการส่งซ้ำระหว่าง request
- ถ้าผู้ใช้แก้ต่อระหว่าง request ต้องรักษา draft ใหม่ และอัปเดต version/baseline ของ snapshot ที่ server รับแล้วเท่านั้น
- Response สำเร็จใช้ version ใหม่จาก server; no-op save ฝั่ง UI ไม่จำเป็นต้องยิง request
- หาก network timeout หลัง POST/PUT ห้าม retry mutation อัตโนมัติ เพราะ server อาจบันทึกแล้ว ให้ตรวจข้อมูลล่าสุดก่อนดำเนินการต่อ
- 409 เก็บ draft แสดงผู้ใช้เลือกโหลดล่าสุดหลังยืนยัน หรือทำสำเนา ห้ามเอา current_version มา retry ทับเอง
- สำเนาในสำนักงานเดิมที่มี stale asset_ref ต้องให้ผู้ใช้ถอด/เปลี่ยน links ที่ใช้ไม่ได้ก่อน POST เพราะถือว่าเป็น link ใหม่
- การเลือกสำนักงานอื่นตอนทำสำเนาให้ถอด asset_ref หลังแจ้งผู้ใช้ ไม่แอบผูกข้ามสำนักงาน
- Export draft เป็น JSON สำหรับเก็บงานที่ยังบันทึกไม่ได้ทำได้ใน editor; การ import JSON จากไฟล์ยังอยู่นอกขอบเขตรุ่นแรก
- ไม่บันทึก token ลง document, undo stack, draft file หรือ logs

## 10. Auth/session ระหว่างดูและแก้แบบ

ตัวจัดการ session ปัจจุบันใน App พาไป login เมื่อ token ปัจจุบันได้ 401 จึงต้องปรับอย่างจำกัดสำหรับเส้นทางสำนักงาน:

- ผู้ดู public ที่ token หมดอายุให้ล้าง session และโหลด GET ใหม่โดยไม่แนบ token กลับเป็นโหมดอ่าน
- หาก editor มี draft เมื่อ session หมดอายุ ให้รักษา draft ไว้ในหน่วยความจำและพักการแก้/บันทึก พร้อมให้เก็บ draft เป็นไฟล์และเข้าสู่ระบบใหม่ ไม่ navigate จนงานหาย
- กรณี login/SSO ต้องเปลี่ยนหน้าและทิ้งหน่วยความจำ ให้เก็บ recovery draft ชั่วคราวที่ผูก user/drawing/version โดยไม่เก็บ token และคืนเฉพาะบัญชีเดิมหลังยืนยัน session หรือให้ผู้ใช้ดาวน์โหลดก่อนออก; ต้องเลือกและทดสอบ flow นี้ก่อนเปิด editor
- ไม่แสดง recovery draft ของบัญชีหนึ่งให้บัญชีอื่น และล้างเมื่อบันทึก/ผู้ใช้ทิ้ง draft อย่างชัดเจน
- 403 แสดงว่าไม่มีสิทธิ์ ไม่ logout; 503 แสดงระบบขัดข้องและรักษา session/draft
- ป้องกัน response permissions จาก session เก่ากลับมาเปิดเครื่องมือเขียนหลัง logout
- ทดสอบ regression auth/navigation ของหน้าที่มีอยู่เดิม เพราะการเปลี่ยน global handler มีผลข้ามหน้า

## 11. การพิมพ์ให้ใกล้ภาพตัวอย่าง

- ใช้ renderer เดียวกับ editor ใน print preview แต่ซ่อน grid/selection handles/sidebar/เครื่องมือ
- ขนาด SVG/page ตรง mm ของ A4/A3 และ orientation; งานพิมพ์ clip ตามขอบกระดาษ
- แสดงกรอบกระดาษ หัวข้อ อาคาร อุปกรณ์ เส้นสาย Legend และ title block
- รอ font/logo พร้อมก่อนสั่ง print และตรวจภาษาไทยใน PDF ที่ browser สร้าง
- แสดงคำแนะนำให้เลือกกระดาษตรงกับแบบและปิด browser headers/footers ตามต้องการ
- ไม่ต้องเรียก API PDF เพิ่ม และไม่ใช้ screenshot ของ canvas เป็นผลพิมพ์หลัก
- ข้อความ/วัตถุที่อยู่นอกกระดาษหรือทับ title block ให้ preview เห็นได้ก่อนพิมพ์ ไม่แก้ตำแหน่งอัตโนมัติระหว่างบันทึก

## 12. โครงสร้างไฟล์ที่เสนอ

```text
src/components/offices/
  Offices.jsx                   รายการสำนักงาน
  OfficeDrawingList.jsx         รายการ/สร้าง/ลบแบบ
  OfficeDrawingPage.jsx         โหลดแบบและจัดการ session/draft
  officeDrawingApi.js           Query, API, errors, writable payload
  officeDrawingDocument.js      Schema helpers, defaults, IDs, validation
  officeDrawingGeometry.js      Coordinates, anchors, snapping, transforms
  officeDrawingHistory.js       Commands, undo/redo, saved baseline
  officeDrawingTemplates.js     แม่แบบไม่มีทะเบียนจริงติดมา
  editor/
    DrawingEditor.jsx
    DrawingToolbar.jsx
    DrawingInspector.jsx
    DrawingLayers.jsx
    EquipmentLinkPicker.jsx
  rendering/
    DrawingRenderer.jsx
    DrawingSymbols.jsx
    DrawingLegend.jsx
    DrawingTitleBlock.jsx
    DrawingPrintPreview.jsx
  Offices.css
```

เชื่อม App.jsx, Sidebar.jsx, navigationGuard/authSession เท่าที่จำเป็น และอัปเดต USER_GUIDE/About เมื่อฟีเจอร์พร้อม

ใช้ primitives เดิม เช่น modal, confirm, list styles เมื่อเหมาะสม; ไม่ย้ายหรือแก้โค้ด dashboard ที่ไม่เกี่ยวข้อง

## 13. ลำดับดำเนินงานและเกณฑ์จบ

| ระยะ | งาน | เกณฑ์จบ |
|---|---|---|
| 1 | รับ fixtures/capabilities เต็ม, สรุป defaults/z-order, API/document helpers | อ่าน fixtures ครบทุก type, สร้าง writable payload ตรง schema |
| 2 | Renderer prototype, symbols, legend/title block และ print | แสดงผังห้อง/เดินสายใกล้ตัวอย่าง และ A4/A3 อ่านได้ |
| 3 | เมนู/รายการสำนักงาน/รายการแบบ/หน้าอ่าน public | เปิดลิงก์ตรง ค้น/แบ่งหน้า/Back ได้และดูโดยไม่มี token |
| 4 | Editor geometry/selection/grid/toolbar/inspector/history | สร้าง/ย้าย/หมุน/ปรับขนาด/วาดสายและ Undo/Redo ได้ |
| 5 | สร้าง/บันทึก/สำเนา/ลบ/version conflict | ไม่เขียนทับงานคนอื่น, draft ไม่หายเมื่อ error/session หมดอายุ |
| 6 | Equipment links/layers/permissions | สิทธิ์สาม role ถูกต้อง และ stale links ไม่ทำให้ผังเสีย |
| 7 | Integration/print/responsive/accessibility/คู่มือ | ผ่านเกณฑ์ด้านล่างบน backend รุ่นที่ติดตั้งจริง |

ไม่เปิด mutation กับ environment ที่ยังไม่มี migration/endpoint รุ่นนี้ ระบุสถานะไม่พร้อมแทนการเก็บข้อมูลเงียบ ๆ แล้วทำเหมือนบันทึก server สำเร็จ

## 14. การทดสอบที่จำเป็น

### Unit/behavior tests

- แปลงพิกัด screen/document ภายใต้ zoom/pan, rotation anchors และ snap
- ย้าย/หมุน object แล้วสายที่ผูกเปลี่ยนปลายอย่างถูกต้อง; ลบแล้วไม่มี reference ขาด
- Undo/Redo gesture เดียวหนึ่ง action, duplicate IDs/references ถูกต้อง
- Payload ตัด read-only fields, คงภาษาไทย/null/ทศนิยม และตรวจ enums/limits
- Expected version, stale response และ save snapshot ไม่ทับ draft ที่แก้ต่อ
- Auth หมดอายุ, เปลี่ยนบัญชี, navigation guard และ recovery draft
- สิทธิ์ readonly ไม่ก่อ mutation จาก pointer/keyboard shortcuts

### Integration/ตรวจหน้าจอจริง

- [ ] Public อ่าน selectors/list/detail/equipment-links ได้โดยไม่ส่ง token
- [ ] สาม role สร้าง/แก้ไข/ลบได้; operator/role อื่นได้ 403 แม้เรียก API ตรง
- [ ] Fixtures ผังห้องและเดินสาย render/บันทึก/GET กลับได้ครบ
- [ ] สอง session แก้ version เดียวกัน ผู้บันทึกทีหลังได้ 409 โดยงานแรกไม่ถูกทับ
- [ ] POST/PUT validation error, 413 และ network timeout ไม่ทำ draft หายหรือสร้างสำเนาซ้ำอัตโนมัติ
- [ ] ย้าย/ลบอุปกรณ์แล้วเปิดผังได้, แสดง state ถูกต้อง, บันทึก link เดิมได้, link ใหม่ผิดสำนักงานได้ 422
- [ ] ลบแบบเป็น soft delete ไม่ลบสำนักงานหรือทะเบียน
- [ ] Drag/resize/rotate/cancel และ keyboard ทำงานทั้งเมาส์และ touch ที่รองรับ
- [ ] Preview/Save as PDF ภาษาไทยครบ โลโก้/legend/title block ตรงกระดาษ A4/A3
- [ ] ข้อมูลขนาดใกล้ limits ใช้งานได้ ไม่ค้างเมื่อเลือก/ลาก/Undo และไม่สร้าง DOM preview ซ้ำทั้งชุดทุก pointermove โดยไม่จำเป็น
- [ ] Build/lint/tests ที่เกี่ยวข้องผ่าน และหน้าระบบเดิมไม่เสียพฤติกรรม

## 15. ข้อมูลที่ยังรอและข้อจำกัดการตรวจรับ

1. Fixture `network-layout.json` และ `floor-plan.json` พร้อม capabilities response เต็ม ยังไม่ได้รับไฟล์แนบใน workspace ที่ตรวจ
2. Backend ยืนยัน z-order ระหว่าง layer/object และ default values ของ optional/null เพื่อให้ renderer ตรงกัน
3. Dev URL, รุ่นที่ติดตั้ง, migration และบัญชีทดสอบผ่านช่องทางทีม; ไม่ใส่ credentials ในเอกสาร
4. ผลทดสอบ moved/deleted ของ equipment-links ที่ backend ระบุว่ายังไม่ทดสอบจริง
5. ข้อเสนออนุญาต URL เป็น plain text เป็นงานปรับปรุงที่ไม่ขวางการเริ่ม; ระหว่างนี้ UI ยึด validation ที่ส่งมอบ

เริ่มทำโครงหน้าและ prototype จาก schema ที่มีได้ระหว่างรอ โดยใช้ค่าที่เสนอเป็นสมมติฐานที่ระบุไว้ ไม่ถือว่า backend ยืนยันแล้ว ผล tests ที่ backend รายงานไม่แทนการตรวจรับ integration ของ frontend
