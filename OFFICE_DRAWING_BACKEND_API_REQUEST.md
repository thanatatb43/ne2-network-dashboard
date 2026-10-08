# คำขอ API — เมนู “สำนักงาน” และเครื่องมือวาดผัง

วันที่: 7 ตุลาคม 2569

สถานะ: ข้อเสนอ contract เพื่อให้ backend ประเมินและตอบรับ ยังไม่ใช่ endpoints ที่มีอยู่จริง; ผู้ใช้ยืนยันสิทธิ์แล้ว: ดูผังได้โดยไม่ต้อง login ส่วนเพิ่ม/แก้ไข/ลบเฉพาะ super_admin, network_admin, computer_admin

## 1. เป้าหมายที่ผู้ใช้ยืนยัน

เพิ่มเมนูหลัก **“สำนักงาน”** แยกจาก dashboard อุปกรณ์ ให้เลือกสำนักงาน เปิดรายการแบบ สร้างผังอย่างง่าย บันทึก และกลับมาแก้ต่อได้

ภาพตัวอย่างจากผู้ใช้เป็นผังเชื่อมต่อเครือข่ายระหว่างอาคาร มีกรอบอาคาร ชื่อห้อง จุดอุปกรณ์ แนวสายหักมุม สี/เส้นประแยกชนิดสาย จุด Outlet คำอธิบายสัญลักษณ์ และกรอบชื่อแบบมุมล่างขวา จึงต้องรองรับมากกว่าการวาดแปลนห้องอย่างเดียว

### ขอบเขตรุ่นแรก

- เลือกประเภทแบบ “ผังสำนักงาน/ห้อง” หรือ “ผังแนวเดินสายระหว่างอาคาร” ใช้ editor และ schema เดียวกัน
- วาดอาคาร/ห้อง ผนัง ประตู หน้าต่าง โต๊ะ ข้อความ และสัญลักษณ์อุปกรณ์
- ลากย้าย หมุน ปรับขนาด จัดแนวตาม grid และ Undo/Redo ฝั่ง frontend
- วาดแนวสายแบบ polyline มีหลายจุดหักมุม เลือกสี เส้นทึบ/เส้นประ และป้ายกำกับ
- มีคลังสัญลักษณ์ เช่น PC, Notebook, Printer, Switch, Router, AP, Rack, Outlet และ junction
- ผูกวัตถุกับทะเบียนอุปกรณ์เดิมได้ หรือวางเป็นสัญลักษณ์สำหรับงานออกแบบโดยไม่ต้องสร้างทะเบียนจริง
- เพิ่ม legend และ title block เพื่อจัดหน้าให้ใกล้ภาพตัวอย่าง
- เลือก A4/A3 แนวตั้ง/แนวนอน พิมพ์หรือบันทึก PDF ผ่านหน้าพิมพ์ของ browser
- บันทึกแบบเป็นข้อมูลที่แก้ต่อได้ ไม่เก็บเพียงภาพสำเร็จรูป

### ยังไม่รวม

- แปลง PDF เป็นผนัง/ประตู/อุปกรณ์อัตโนมัติ
- CAD เต็มรูปแบบ, DWG, 3D, การคำนวณโครงสร้าง และการแก้แบบพร้อมกันแบบ real-time
- การคำนวณ BOQ/ราคาประมาณการอัตโนมัติ แม้ภาพตัวอย่างจะมีชื่อเรื่องเกี่ยวกับประมาณการ
- การนำ PDF/ภาพมาเป็นพื้นหลังและการแนบไฟล์ เป็น phase ถัดไป
- การอ้างความยาวสายจากระยะที่วาดว่าเป็นความยาวติดตั้งจริง

## 2. หน้า UI ที่จะใช้ API

เส้นทาง frontend ที่เสนอ:

```text
/offices                         เลือกสำนักงาน
/offices/:siteId/drawings        รายการแบบของสำนักงาน
/offices/:siteId/drawings/new    สร้างแบบจากแม่แบบ
/offices/:siteId/drawings/:id    ดู/แก้ไขแบบ
```

รายชื่อสำนักงานต้องรวมสำนักงานที่ไม่มีอุปกรณ์เครือข่ายสำหรับ monitoring ด้วย ไม่ใช้รายการที่หน้าแผนที่กรองไว้แล้วเป็นรายการสำนักงานทั้งหมด

หนึ่งสำนักงานมีหลายแบบได้ เช่น ผังชั้น 1, ผังชั้น 2, ผังอาคารภายนอก ไม่บังคับสร้าง master อาคาร/ชั้นชุดใหม่ในรุ่นแรก ใช้ building_label/floor_label ของแบบก่อน

## 3. API เดิมและสิ่งที่ขอเพิ่ม

API เดิม `/api/pea-sites` และรายละเอียดอุปกรณ์ยังใช้ต่อได้ โดยไม่เปลี่ยน shape หรือสิทธิ์เพราะงานนี้

ขอ API ใหม่ภายใต้ `/api/office-drawings` เพื่อแยกวงจรบันทึกผังจากการแก้ทะเบียนจริง:

| Method / Path | หน้าที่ |
|---|---|
| GET `/selectors` | สำนักงานที่อ่าน/สร้างแบบได้ และชนิดแบบที่รองรับ |
| GET `/capabilities` | schema version, ข้อจำกัด payload, object/symbol/style allowlists |
| GET `/` | รายการแบบตามสำนักงาน พร้อม pagination |
| POST `/` | สร้างแบบใหม่จาก document ที่ frontend ส่ง |
| GET `/:id` | Metadata, document, version และ permissions ของแบบ |
| PUT `/:id` | บันทึก metadata/document ทั้งชุดพร้อมตรวจ version |
| DELETE `/:id` | Soft delete พร้อมตรวจ version และสิทธิ์ |
| GET `/equipment-options` | ค้นอุปกรณ์สำหรับวางบนผังตามสำนักงาน |
| GET `/:id/equipment-links` | Resolve links ของแบบเป็นข้อมูลทะเบียนปัจจุบันใน request เดียว |

Mount static routes ก่อน `/:id` ถ้าใช้ Express router เพื่อไม่ให้ชื่อ endpoint ถูกตีความเป็น ID

### รายการแบบ

`GET /api/office-drawings?pea_site_id=181&search=ชั้น&page=1&limit=20&sort=updated_at&order=desc`

- pea_site_id เป็น positive integer; ไม่ส่งให้ค้นใน scope ที่ผู้ใช้มีสิทธิ์
- search ค้นชื่อแบบ/building_label/floor_label แบบ literal substring สูงสุด 200 ตัวอักษร
- drawing_type=`floor_plan|network_layout` เป็น optional filter
- page >= 1; limit 1–100 default 20
- sort=`updated_at|name|created_at`; default updated_at DESC; tie-breaker id DESC
- กรองและ sort ก่อน pagination, ไม่รวม soft-deleted
- คืนเฉพาะ metadata ไม่ส่ง document ทุกแบบใน list

```json
{
  "success": true,
  "data": [{
    "id": 42,
    "pea_site_id": 181,
    "pea_site_name": "สำนักงานตัวอย่าง",
    "name": "ผังเครือข่ายระหว่างอาคาร",
    "drawing_type": "network_layout",
    "building_label": null,
    "floor_label": null,
    "version": 3,
    "schema_version": 1,
    "updated_at": "2026-10-07T03:00:00.000Z",
    "updated_by": { "id": 7, "display_name": "ผู้จัดทำตัวอย่าง" },
    "permissions": { "can_edit": true, "can_delete": false }
  }],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

หน้าที่เกินคืน data=[] โดยคง total จริง; ไม่มีข้อมูลให้ totalPages=0

### Selectors และ capabilities

- selectors คืน `sites: [{value,label,can_create}]`, `drawing_types: [{value,label}]` ภายใต้ scope จริง
- หากสำนักงานมีจำนวนมาก ขอรองรับ search/page/limit และระบุ pagination ชัดเจน ไม่ตัดรายการโดยไม่แจ้ง
- capabilities คืน schema_versions, default_schema_version, limits, object_types, symbol_keys, cable_styles และ permissions.can_create ตาม role โดยการสร้างจริงยังตรวจ site scope อีกครั้ง
- คลังรูปสัญลักษณ์อยู่ฝั่ง UI; backend ส่ง key ที่เสถียร เช่น router/switch/outlet ไม่ส่ง HTML/SVG จากผู้ใช้มารัน
- ข้อมูล capabilities ช่วยปิดเครื่องมือที่ server ยังไม่รองรับ แต่ server ยังต้อง validate ทุก request

## 4. สัญญาการสร้างและบันทึก

ใช้ JSON และ Bearer token ตามสิทธิ์ที่ตกลง:

```json
{
  "pea_site_id": 181,
  "name": "ผังเครือข่ายระหว่างอาคาร",
  "drawing_type": "network_layout",
  "building_label": null,
  "floor_label": null,
  "schema_version": 1,
  "document": {
    "page": { "size": "A3", "orientation": "landscape", "width": 420, "height": 297, "unit": "mm", "margin": 10 },
    "grid": { "enabled": true, "spacing": 5, "snap": true },
    "scale": { "mode": "schematic", "denominator": null },
    "title_block": {
      "project_name": "ติดตั้งสายสัญญาณระหว่างอาคาร",
      "drawing_title": "ผังแนวเดินสาย",
      "location": "สำนักงานตัวอย่าง",
      "drawing_number": "NET-001",
      "revision_label": "A",
      "issued_date": "2026-10-07",
      "prepared_by": "ผู้จัดทำตัวอย่าง",
      "checked_by": "",
      "contact": "",
      "sheet_number": "1/1",
      "logo_key": "pea"
    },
    "layers": [
      { "id": "layout", "name": "อาคารและห้อง", "visible": true, "locked": false },
      { "id": "network", "name": "อุปกรณ์และสาย", "visible": true, "locked": false }
    ],
    "objects": [
      { "id": "building-1", "type": "building", "layer_id": "layout", "x": 20, "y": 70, "width": 100, "height": 60, "rotation": 0, "label": "อาคารสำนักงาน", "style": { "stroke": "#222222", "stroke_width": 0.4, "fill": "#FFFFFF" } },
      { "id": "switch-1", "type": "equipment", "layer_id": "network", "x": 30, "y": 110, "width": 8, "height": 8, "rotation": 0, "symbol_key": "switch", "label": "SW-01", "asset_ref": null },
      { "id": "junction-1", "type": "junction", "layer_id": "network", "x": 150, "y": 40, "width": 3, "height": 3, "rotation": 0, "label": "J1" },
      { "id": "cable-1", "type": "cable", "layer_id": "network", "points": [{ "x": 34, "y": 114 }, { "x": 34, "y": 40 }, { "x": 151.5, "y": 40 }], "start": { "object_id": "switch-1", "anchor": "center" }, "end": { "object_id": "junction-1", "anchor": "center" }, "cable_style_key": "fiber", "label": "Fiber backbone", "label_position": { "x": 90, "y": 35, "rotation": 0 }, "measured_length_m": 150, "style": { "stroke": "#F97316", "stroke_width": 0.8, "dash": "solid" } }
    ],
    "legend": {
      "visible": true,
      "x": 15,
      "y": 225,
      "items": [
        { "kind": "symbol", "symbol_key": "switch", "label": "จุดเชื่อมต่อระบบเครือข่ายภายในสำนักงาน" },
        { "kind": "line", "cable_style_key": "fiber", "label": "แนวเดินสาย Fiber Optic ระหว่างอาคาร" }
      ]
    }
  }
}
```

ตัวอย่างเป็น schematic ไม่ใช้ระยะบนกระดาษคำนวณความยาวสายจริง measured_length_m คือค่าที่ผู้ใช้กรอกจากการสำรวจและเป็น optional ไม่บังคับให้สอดคล้องกับความยาว polyline

POST สำเร็จ 201; GET/PUT สำเร็จ 200 โดย data คืน metadata ทั้งหมด, schema_version, document, version, permissions และ timestamps ที่ server กำหนด

PUT ใช้ schema เดียวกับ POST พร้อม `expected_version` แต่ pea_site_id ของแบบแก้ไม่ได้ในรุ่นแรก; หากต้องทำแบบของอีกสำนักงานให้สร้างใหม่และตรวจ links ใหม่

บันทึก document เป็น JSON ที่ไม่ผูกกับ internal serialization ของ library canvas เพื่อเปลี่ยน renderer ในอนาคตได้

## 5. ข้อกำหนด document schema v1

### ระบบพิกัด

- หน่วย mm ของกระดาษ; origin มุมซ้ายบน, x เพิ่มไปขวา, y เพิ่มลงล่าง
- A4=210×297, A3=297×420; width/height สลับเมื่อ landscape และต้องตรง size/orientation
- x/y ของวัตถุรูปสี่เหลี่ยมคือมุมซ้ายบนก่อนหมุน; rotation องศาตามเข็มนาฬิการอบจุดกึ่งกลาง bounding box
- Polyline points และ label_position เป็นพิกัดกระดาษ ไม่ใช่พิกัดภูมิศาสตร์
- Zoom/pan/selection/undo stack เป็น state ชั่วคราวฝั่ง frontend ไม่ต้องบันทึกใน document
- ลำดับใน layers กำหนดลำดับซ้อนของชั้น และลำดับ objects ในแต่ละ layer กำหนด z-order
- รุ่นแรกใช้ scale.mode=schematic และ denominator=null; หากเพิ่มมาตราส่วนจริงต้องเพิ่มนิยามและ test ก่อนนำไปวัดระยะ

### ชนิดวัตถุและ fields เพิ่มจากส่วนกลาง

| type | ข้อมูลเฉพาะ |
|---|---|
| building, room, desk | x/y/width/height/rotation, label, style |
| wall | points อย่างน้อย 2 จุด, thickness เป็นความหนาเส้นบนกระดาษ |
| door | x/y/width/height/rotation, hinge=`left|right`, swing=`in|out`; frontend ใช้เส้นโค้งแสดงทิศเปิด |
| window | x/y/width/height/rotation |
| equipment, outlet, junction | bounding box, symbol_key สำหรับ equipment/outlet, label, asset_ref nullable |
| cable | points อย่างน้อย 2 จุด, start/end nullable, cable_style_key, style, label, label_position, measured_length_m nullable |
| text | x/y/width/height/rotation, text, font_size หน่วย mm, align=`left|center|right` |

ทุกวัตถุมี id เป็น string ที่ frontend สร้างและคงเดิมเมื่อแก้ไข, type และ layer_id ที่มีอยู่จริง style รองรับสี hex, stroke_width หน่วย mm, fill และ dash=`solid|dashed|dotted` ตามความเหมาะสมของชนิด

Door/window รุ่นแรกเป็นวัตถุวางอิสระ Frontend ช่วย snap กับผนัง ไม่ต้องให้ backend คำนวณการตัดช่องผนังหรือ topology ทางสถาปัตยกรรม

Cable anchor=`center|top|right|bottom|left` ของ bounding box หลัง rotation; frontend คำนวณ endpoints และส่ง points ที่อัปเดตเมื่อย้ายอุปกรณ์ Backend ตรวจ reference แต่ไม่ route เส้นให้เอง

เมื่อผู้ใช้ลบวัตถุที่สายอ้างถึง frontend ต้องลบ reference ที่ start/end เป็น null โดยคง points ล่าสุด หรือให้ผู้ใช้ลบสายไปด้วย Server ปฏิเสธ dangling object_id ไม่ซ่อมผังโดยเงียบ ๆ

Legend รุ่นแรกใช้รายการที่ผู้ใช้แก้ได้ ไม่อ้างว่าเป็นการนับอุปกรณ์จริงอัตโนมัติ Title block ใช้ layout มาตรฐานฝั่ง UI ที่มุมล่างขวาภายใน margin; logo_key ใช้ asset ที่ระบบกำหนด ไม่รับ arbitrary URL

ขอ backend ส่ง JSON Schema หรือรายละเอียด discriminator/required/defaults ของแต่ละ type ให้ตรงกับตารางนี้ก่อน implementation UI และส่ง fixtures ของผังห้อง/ผังเดินสายอย่างละหนึ่งแบบ

## 6. การผูกทะเบียนอุปกรณ์

```json
{ "asset_ref": { "kind": "office_equipment", "id": 19376 } }
```

หรือ kind=`network_device` ตาม model อุปกรณ์เครือข่ายเดิม; asset_ref=null คือวัตถุออกแบบที่ยังไม่ผูกทะเบียน

### GET /equipment-options

รับ pea_site_id (required), kind=`office_equipment|network_device`, search, page, limit และตอบ:

```json
{
  "success": true,
  "data": [{ "kind": "office_equipment", "id": 19376, "label": "PC ตัวอย่าง", "equipment_type": "PC", "equipment_code": "PC-001", "serial_number": "DEMO123", "pea_site_id": 181 }],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

- แสดงเฉพาะ active records ของสำนักงานในสิทธิ์ผู้ใช้; search แบบ literal substring ใน fields ที่รองรับและประกาศ allowlist
- ถ้า API เดิมให้ข้อมูลนี้ครบและไม่โหลดประวัติ/รูปทั้งชุด backend เสนอใช้เดิมแทน endpoint ใหม่ได้ แต่ต้องยืนยัน pagination และ site filtering ของทั้งสอง kind
- ตอนสร้าง link ใหม่ตรวจชนิด ID สิทธิ์ และสำนักงานให้ตรงแบบ ไม่ย้ายสำนักงานในทะเบียนอัตโนมัติ
- หนึ่งทะเบียนอาจปรากฏหลายแบบ เช่น แบบอาคารและแบบภาพรวม; ไม่กำหนด global unique constraint บน equipment_id

### GET /:id/equipment-links

คืน `data: [{object_id,kind,id,state,asset}]`; state=`available|moved|deleted|unavailable` และ asset=null เมื่อไม่สามารถเปิดข้อมูลได้

- ถ้าอุปกรณ์ถูกลบ/ย้ายหลังวางผัง ให้ยังเปิดผังและเห็นตำแหน่งเดิมได้ พร้อมแจ้งเตือน reference
- ไม่ลบวัตถุจากผังเพียงเพราะข้อมูลทะเบียนเปลี่ยน
- PUT ที่ไม่ได้เปลี่ยน asset_ref เดิมซึ่งกลายเป็น stale ควรบันทึกส่วนอื่นได้; link ใหม่/เปลี่ยน link ต้องผ่าน validation ปัจจุบัน
- ไม่ส่งข้อมูลอุปกรณ์ที่ผู้ใช้ไม่มีสิทธิ์ใน asset หรือ error details
- Label บนผังเป็นข้อความที่ผู้ใช้จัดทำ ไม่เขียนทับด้วยชื่อทะเบียนอัตโนมัติ; asset แสดงข้อมูลปัจจุบันในแผงรายละเอียด

## 7. การป้องกันเขียนทับและ audit

- version เป็น integer เริ่ม 1; PUT ส่ง expected_version
- ตรวจ expected_version และเพิ่ม version พร้อมบันทึก document ใน transaction เดียว ไม่ใช้เพียง updated_at เทียบจาก browser
- Version ไม่ตรงตอบ 409 VERSION_CONFLICT พร้อม current_version และ updated_at โดยไม่เขียนทับ
- UI เก็บ draft และให้โหลดรุ่นล่าสุด/สร้างสำเนา ไม่ retry PUT ด้วย version ใหม่โดยอัตโนมัติ
- DELETE ส่ง JSON `{ "expected_version": 3 }` และตรวจแบบเดียวกัน; สำเร็จ 200 `{ "success": true, "data": { "id": 42, "deleted": true } }`
- updated_by/created_by มาจาก token ไม่รับจาก client
- เก็บ audit สำหรับ create/update/delete พร้อม drawing ID, version, actor, timestamp โดย audit ไม่บันทึก token
- Undo/Redo เป็นหน้าที่ frontend; API ประวัติ snapshot/restore revision เต็มรูปแบบยังไม่บังคับในรุ่นแรก

## 8. สิทธิ์และ validation

### นโยบายที่ผู้ใช้ยืนยัน

| การทำงาน | ไม่ login | Role อื่น เช่น operator | super_admin / network_admin / computer_admin |
|---|---|---|---|
| ดูรายการสำนักงาน/แบบ เปิดดูผัง และพิมพ์จากหน้าดู | ได้ | ได้ | ได้ |
| สร้างแบบ/สำเนาแบบ | ไม่ได้ | ไม่ได้ | ได้ |
| แก้ไขชื่อ รายละเอียด วัตถุ และการผูกอุปกรณ์ | ไม่ได้ | ไม่ได้ | ได้ |
| ลบแบบ | ไม่ได้ | ไม่ได้ | ได้ |

- GET `/`, `/selectors`, `/capabilities`, `/:id` และ `/:id/equipment-links` เป็น public เพื่อให้เปิดดูผังได้ครบโดยไม่ต้องมี token
- GET `/equipment-options` เป็นเครื่องมือเลือกทะเบียนเพื่อแก้ไขแบบ ให้ใช้ Bearer token และจำกัดสาม role เดียวกับการเขียน ไม่จำเป็นต่อหน้าดู public
- POST `/`, PUT `/:id` และ DELETE `/:id` ต้องตรวจ Bearer token และ role เฉพาะ `super_admin`, `network_admin`, `computer_admin` ที่ server
- ผู้ไม่ login หรือ role อื่นเห็นเมนู “สำนักงาน” และเปิดผังในโหมดอ่านได้ แต่ไม่มีปุ่มเพิ่ม/ลบ/แก้ไข รวมการลากวัตถุหรือบันทึกแบบ
- Public response คืน permissions.can_create/can_edit/can_delete=false ตามตำแหน่งของ schema; หากส่ง token ที่ตรวจสอบได้ให้คำนวณตาม role จริง ไม่เชื่อ permissions ที่ client ส่ง
- Frontend เรียก public GET โดยไม่แนบ token เมื่อยังไม่มี session; การไม่มี token ไม่ใช่เหตุให้ public GET ตอบ 401
- สิทธิ์อ่านครอบคลุมแบบที่ยังไม่ถูกลบ ส่วนข้อจำกัดสำนักงานสำหรับการเขียน หากระบบเดิมมีอยู่ ให้ backend ระบุเพิ่มอย่างชัดเจน โดยไม่เปลี่ยนสาม role ที่ผู้ใช้อนุญาต
- Resolve links ของหน้าดู public ส่งเฉพาะข้อมูลทะเบียนที่เปิด public ได้ตาม contract เดิม ไม่เพิ่มข้อมูลส่วนที่เดิมจำกัดสิทธิ์
- ตรวจสิทธิ์เขียนจริงจาก server ไม่อาศัยการซ่อนปุ่ม frontend และไม่เปลี่ยนสิทธิ์ API ทะเบียนเดิมเพราะเพิ่มเมนูนี้

### ข้อจำกัดเริ่มต้นที่เสนอ

- name 1–200 ตัวอักษร; label 500; text/notes 5,000; search 200
- JSON request สูงสุด 2 MiB; 2,000 objects, 30 layers, 500 points ต่อ polyline, 100 legend entries
- ตัวเลขต้อง finite; dimensions เป็นบวก, stroke_width > 0; พิกัดอนุญาตนอกขอบกระดาษได้ในช่วง -10,000 ถึง 10,000 mm โดยงานพิมพ์ clip ตามกระดาษ
- Object IDs ไม่ซ้ำ, layer/reference มีจริง, enum และ schema_version ต้องรองรับ
- ไม่รับ base64 images, arbitrary HTML/SVG/scripts หรือ remote URLs ใน document; ข้อความ render เป็น plain text
- Reject document ผิด schema ทั้งชุด ห้ามทิ้ง objects ที่ไม่รู้จักแล้วตอบบันทึกสำเร็จ
- ฟิลด์ optional ใน JSON ใช้ null เพื่อล้างได้ตาม schema งานนี้ไม่ใช้ sentinel `"-"` ของฟอร์มทะเบียนอุปกรณ์เดิม
- หาก server ไม่รองรับ schema_version ใหม่ ให้ปฏิเสธ write และ UI เปิด read-only แทนการบันทึกแบบเสียรายละเอียด

ขอให้ backend ยืนยัน limits ที่ใช้จริงและส่งกลับผ่าน capabilities

## 9. Response/error กลาง

ใช้ `{success:true,data,...}` และ pagination ตามตัวอย่าง; timestamps ISO UTC

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DOCUMENT",
    "message": "Cable endpoint references an unknown object",
    "field": "document.objects[3].end.object_id"
  }
}
```

| HTTP | code / ความหมาย |
|---|---|
| 400 | INVALID_QUERY / INVALID_DOCUMENT / UNSUPPORTED_SCHEMA_VERSION |
| 401 | AUTH_TOKEN_* สำหรับเส้นที่ต้องใช้ token หรือ token ที่ส่งมาตรวจไม่ผ่าน; public GET ที่ไม่ส่ง token ต้องอ่านได้ |
| 403 | AUTH_FORBIDDEN เมื่อ role ไม่ใช่สาม role ที่อนุญาตสำหรับการเขียน/เลือกอุปกรณ์ หรือผิด write scope ที่กำหนด |
| 404 | DRAWING_NOT_FOUND สำหรับแบบไม่มี/ถูกลบ หรือซ่อนการมีอยู่ตามนโยบายสิทธิ์ |
| 409 | VERSION_CONFLICT |
| 413 | DOCUMENT_TOO_LARGE |
| 422 | INVALID_ASSET_REFERENCE สำหรับ link ใหม่ที่ใช้ไม่ได้ |
| 503 | AUTH_SERVICE_UNAVAILABLE ตามระบบเดิม; ไม่ logout |
| 500 | INTERNAL_ERROR โดยไม่ส่ง SQL/stack/credentials |

CORS ใช้ frontend origin ที่ระบบกำหนดและรองรับ Authorization, Content-Type, GET/POST/PUT/DELETE/OPTIONS

## 10. การพิมพ์และรูปแบบให้คล้ายตัวอย่าง

Frontend สร้าง artwork แบบ vector จาก document และจัดพิมพ์:

- เส้นกรอบกระดาษและหัวข้อด้านบน
- อาคาร/ห้องเป็นเส้นเรียบ พร้อมชื่อภายใน
- สาย Fiber สีส้ม, UTP สีฟ้า และเส้นประเทาตาม style key ที่ตกลง
- จุด Outlet และอุปกรณ์ใช้ชุดสัญลักษณ์มาตรฐานพร้อม label
- Legend ล่างซ้ายและ title block ล่างขวา พร้อมโลโก้ที่ระบบมีสิทธิ์ใช้งาน
- ซ่อน grid/selection handles/เครื่องมือ editor ในหน้าพิมพ์

ไม่ต้องมี server-side PDF endpoint ในรุ่นแรก พิมพ์/Save as PDF จาก browser ได้ หากภายหลังต้องสร้าง PDF แบบเหมือนกันทุกเครื่องหรือมีลายเซ็นอนุมัติ ให้ตกลง API export เพิ่มแยกต่างหาก

## 11. ลำดับส่งมอบที่ขอจาก backend

1. ตอบรับ schema, limits และการใช้ endpoints เดิมแทน lookup พร้อมยืนยัน implementation ตามสิทธิ์ในข้อ 8; ระบุ write site scope เพิ่มหากมี
2. ส่ง JSON Schema/fixtures สำหรับผังห้องและผังเดินสายตามตัวอย่าง พร้อม error cases
3. Implement selectors/capabilities/list/create/get/update และ version conflict ก่อน เพื่อเริ่ม editor integration
4. เพิ่ม soft delete, equipment-options/equipment-links และ audit ให้ครบก่อนตรวจรับ
5. แจ้ง migrations, รุ่นโค้ด, dev URL และบัญชีทดสอบผ่านช่องทางทีม ไม่ใส่ credentials ในเอกสาร

## 12. Acceptance tests ร่วม

- [ ] บันทึกแล้ว GET กลับได้รูปแบบ/ข้อความ/ตำแหน่ง/สี/เส้นประ/legend/title block ครบ ไม่เสียภาษาไทย
- [ ] ผังมีหลายอาคารและแนวสายหักมุมเหมือนภาพตัวอย่างได้ โดยไม่มี side effect ต่อทะเบียนอุปกรณ์
- [ ] ย้ายอุปกรณ์แล้วบันทึก points/reference ใหม่ กลับมาเปิดตำแหน่งถูกต้อง
- [ ] สร้างสองแบบในสำนักงานเดียวกันได้ แยกชั้น/อาคารด้วย label ได้
- [ ] List/search/pagination อยู่ใน site scope รวมสำนักงานที่ไม่มี monitored device
- [ ] ไม่ส่ง token ก็เปิดรายการแบบ รายละเอียดผัง และข้อมูล links สำหรับหน้าดูได้
- [ ] super_admin, network_admin และ computer_admin สร้าง/แก้ไข/ลบได้ตาม write scope
- [ ] ไม่ login เรียก mutation ได้ 401; operator และ role อื่นได้ 403 แม้เรียก API โดยตรง
- [ ] ผู้ไม่มีสิทธิ์แก้ไขใช้หน้าดู/พิมพ์ได้ แต่ลากวัตถุหรือสั่งบันทึกจาก UI ไม่ได้
- [ ] สอง session แก้ version เดียวกัน ผู้บันทึกทีหลังได้ 409 และข้อมูลแรกไม่ถูกทับ
- [ ] Document ไม่ถูก schema/ใหญ่เกิน/ID ซ้ำ/reference ขาดถูกปฏิเสธโดยไม่บันทึกบางส่วน
- [ ] Link ใหม่ผิดสำนักงานถูกปฏิเสธ; link เดิมที่อุปกรณ์ย้าย/ลบไม่ทำให้ผังเปิดไม่ได้
- [ ] Soft delete ไม่ลบสำนักงานหรืออุปกรณ์ และ audit ระบุผู้กระทำจาก token
- [ ] Browser โหลด/บันทึกข้าม origin และจัดการ 401/403/409/413/503 ได้
- [ ] Frontend พิมพ์ A4/A3 แล้วแสดงภาษาไทย เส้น และกรอบชื่อแบบครบตามขนาดที่เลือก

เอกสารนี้ขอ backend ออกแบบและส่งมอบ API ก่อนเริ่มเชื่อม editor เมนู “สำนักงาน” ไม่ใช่คำสั่ง deploy หรืออนุญาตแก้ทะเบียนเดิม/cleanup ข้อมูลย้อนหลัง
