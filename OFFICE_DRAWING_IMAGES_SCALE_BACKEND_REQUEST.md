# คำขอ Backend — รูปภาพ มาตราส่วน และเส้นบอกระยะในแบบสำนักงาน

วันที่: 7 ตุลาคม 2569

อ้างอิง: `OFFICE_DRAWING_API.md` schema v1

สถานะ: ข้อเสนอ API/schema เพื่อให้ backend ตอบรับก่อนพัฒนา ยังไม่ใช่ contract ที่ implement แล้ว

## 1. ความต้องการและขอบเขต

ผู้ใช้ต้องการวางรูปภาพลงแบบ ทั้งเลือกไฟล์และ Ctrl+V และเห็นระยะขณะลากกรอบ/เส้นเป็น cm–m เพื่อให้แบบมีมาตรฐานเดียวกัน

เอกสารนี้ระบุเฉพาะงาน backend:

1. เก็บรูปภาพแบบถาวรและให้ document อ้างอิงไฟล์ได้
2. เพิ่มมาตราส่วนและการตั้งค่าหน่วย/ระยะ grid ให้ frontend คำนวณระยะจริงอย่างสอดคล้อง
3. เก็บเส้นบอกระยะที่ผู้ใช้ต้องการให้ปรากฏในแบบและตอนพิมพ์
4. รองรับ schema v1 เดิมโดยไม่เปลี่ยนขนาดหรือแก้ข้อมูลย้อนหลังอัตโนมัติ

การแก้ข้อความชิดขอบ/ล้น title block เป็นงาน frontend ใช้ fields เดิม ไม่ขอ API เพิ่ม ส่วนการอ่าน clipboard, ลากวาง, rendering และคำนวณ geometry ระหว่างลากเป็นงาน frontend เช่นกัน

## 2. สิทธิ์

คงสิทธิ์ที่ตกลงสำหรับเมนูสำนักงาน:

- ดูแบบและรูปภาพที่อ้างในแบบ active ได้โดยไม่ต้อง login
- อัปโหลดรูป สร้าง/แก้ไข/ลบแบบ และเปลี่ยนมาตราส่วน เฉพาะ `super_admin`, `network_admin`, `computer_admin`
- Backend ตรวจ token/role จริงทุก mutation; ไม่พึ่งการซ่อนปุ่ม
- รูปใน draft ที่ยังไม่เคยบันทึกลงแบบไม่จำเป็นต้องเปิด public
- การเปิดเผยรูปตามแบบ public ต้องระบุใน UI ก่อนผู้ใช้วาง/อัปโหลด

## 3. API รูปภาพที่เสนอ

Base path: `/api/office-drawings`

| Method / Path | สิทธิ์ | หน้าที่ |
|---|---|---|
| POST `/assets` | สาม role เขียน | อัปโหลดรูปผ่าน multipart/form-data ฟิลด์ file |
| GET `/assets/:assetId` | Public เมื่อถูกอ้างในแบบ active; ไม่เช่นนั้นตรวจสิทธิ์ draft | คืน metadata และ content_url |
| GET `/assets/:assetId/content` | เช่นเดียวกับ metadata | คืนไฟล์รูปสำหรับ render/print |
| DELETE `/assets/:assetId` | สาม role เขียน ตามนโยบาย ownership | ลบไฟล์ที่ไม่ถูกอ้างอิงและอนุญาตให้ลบได้ |

Mount routes assets ก่อน dynamic drawing ID routes ให้ชัดเจน

### 3.1 Upload

รองรับทั้งรูปที่เลือกจากเครื่องและ clipboard โดย frontend แปลง clipboard image เป็น File/Blob แล้วเรียก endpoint เดียวกัน

ข้อจำกัดเริ่มต้นที่เสนอให้ backend ยืนยัน:

- PNG, JPEG, WebP แบบภาพนิ่งเท่านั้น; ยังไม่รองรับ SVG/GIF/PDF และ remote URL import
- สูงสุด 10 MiB ต่อไฟล์และ 25 ล้าน pixels หลัง decode พร้อมเพดาน dimension ที่ประกาศใน capabilities
- ตรวจเนื้อหาไฟล์จริง/การ decode ไม่เชื่อ extension หรือ MIME จาก client เพียงอย่างเดียว
- ปรับ EXIF orientation และกำหนด width_px/height_px จากไฟล์ที่ส่งให้ browser จริง หาก re-encode ต้องแจ้งผลเป็น MIME/ขนาดใหม่
- ลบ metadata ที่ไม่จำเป็น เช่น GPS โดยไม่ทำ transparency หายสำหรับไฟล์ที่รองรับ
- ไม่ฝัง base64 ลง document; multipart upload ใช้ limit แยกจาก JSON document 2 MiB เดิม
- ใช้ ID/ชื่อจัดเก็บที่ server สร้าง ไม่ใช้ชื่อไฟล์ผู้ใช้เป็น path

ตัวอย่าง response 201:

```json
{
  "success": true,
  "data": {
    "id": "asset_abc123",
    "mime_type": "image/png",
    "width_px": 1600,
    "height_px": 900,
    "size_bytes": 245000,
    "content_url": "/api/office-drawings/assets/asset_abc123/content",
    "created_at": "2026-10-07T05:00:00.000Z",
    "state": "temporary"
  }
}
```

ID ในตัวอย่างเป็นข้อเสนอ ไม่ผูกกับชนิด primary key; ขอ backend ยืนยันรูปแบบที่เสถียรก่อน UI implement

### 3.2 รูปในแบบใหม่และการอ้างอิง

- อัปโหลดได้ก่อนมี drawing ID เพื่อให้วางรูปในแบบใหม่ได้
- รูป temporary ผูก uploader; ผู้แก้ที่มีสิทธิ์เข้าถึง draft สามารถโหลดผ่าน authenticated fetch แล้วใช้ Blob URL ใน frontend
- POST/PUT แบบต้องตรวจ asset_id มีจริง ไม่ถูกลบ และผู้เรียกมีสิทธิ์นำมาใช้
- เมื่อบันทึกสำเร็จ server สร้าง/ปรับ reference ของ drawing–asset ภายใน transaction เดียวกับ version/document/audit
- รูปที่อ้างในแบบ active เปิด content public ได้ โดย GET content ไม่ต้องแนบ token
- ไม่ใช้ signed URL ที่หมดอายุเป็นค่าถาวรใน document; เก็บ asset_id แล้ว resolve ผ่าน API
- ไม่อาศัยการนับ reference จาก frontend ต้องคำนวณจาก document ที่ server บันทึก

### 3.3 วงจรไฟล์และสำเนาแบบ

- รูปเดียวใช้ในหลายวัตถุ/หลายแบบได้ รวมการทำสำเนาแบบ; การลบวัตถุหนึ่งไม่ลบไฟล์ที่แบบอื่นใช้
- ถอดรูปจากแบบผ่าน PUT document ตามปกติ ไม่ต้อง DELETE asset ทุกครั้งที่กดลบวัตถุ
- DELETE asset ที่ยังมี active reference ให้ 409 ASSET_IN_USE
- เสนอ temporary TTL 24 ชั่วโมงสำหรับรูปที่อัปโหลดแต่ไม่เคยถูกอ้าง และระยะพักก่อนเก็บกวาดไฟล์ที่เพิ่งไม่มี reference เช่น 7 วัน ให้ backend ยืนยัน
- ระยะพักต้องรองรับ Undo/Redo: PUT สามารถกลับมาอ้างรูปที่เพิ่งถอดได้ในช่วงที่ไฟล์ยังเก็บอยู่และผู้ใช้มีสิทธิ์
- แบบ soft-deleted ไม่ให้ anonymous เข้ารูปผ่าน reference ของแบบนั้นเพียงอย่างเดียว; หากแบบ active อื่นยังใช้ รูปยัง public ตามแบบนั้น
- ไม่ลบไฟล์ที่อยู่ระหว่าง upload/save หรือถูกอ้างโดย concurrent transaction ต้องตรวจ reference ล่าสุดก่อน cleanup
- หากระบบจะรองรับ restore revision ในอนาคต ต้องปรับ retention ให้ครอบคลุม reference ของ revision ก่อนเปิดใช้

## 4. Schema v2: วัตถุ image

เสนอเพิ่ม schema_version=2 เพื่อให้ client รุ่นเก่าที่ไม่รู้จักรูป/มาตราส่วนไม่บันทึกทับจนข้อมูลหาย

```json
{
  "id": "image-1",
  "type": "image",
  "layer_id": "layout",
  "x": 20,
  "y": 30,
  "width": 80,
  "height": 45,
  "rotation": 0,
  "asset_id": "asset_abc123",
  "fit": "contain",
  "opacity": 1,
  "label": "ภาพอาคารสำนักงาน"
}
```

- x/y/width/height คงหน่วย mm บนกระดาษเหมือน v1
- fit=`contain` ในรุ่นแรก; ไม่รองรับ crop จนกว่าจะเพิ่ม schema
- opacity อยู่ระหว่าง 0–1; label เป็น optional plain text
- Frontend รักษาสัดส่วนเมื่อลากปรับขนาดตามค่าเริ่มต้น รูปต้นฉบับไม่ถูกแก้เมื่อวาง/หมุนบนแบบ
- การวางรูปไม่ทำให้รู้ระยะจริงของภาพโดยอัตโนมัติ ไม่ถือว่าเป็นภาพที่ calibrate มาตราส่วนแล้ว
- ไม่รับ URL/base64/HTML/SVG ภายใน image object
- GET แบบยังคืน document ที่อ้าง asset_id; ขอคืน asset metadata ที่ resolve แล้วในฟิลด์นอก document เช่น `data.assets` เพื่อลดการเรียกทีละรูป โดยไม่ส่ง private metadata
- หาก asset ขาดหรือโหลดไม่ได้ frontend ใช้ placeholder และแจ้งเตือน แต่ยังเปิดแบบส่วนอื่นได้; API แยกสถานะ metadata ของ asset ให้ชัดเจน

## 5. มาตราส่วน: คงระบบพิกัดเดิม เพิ่มระยะจริงจาก scale

เพื่อไม่เปลี่ยน renderer และแบบเก่าทั้งระบบ **คง geometry ทุกวัตถุเป็น mm บนกระดาษ** แล้วใช้ scale เป็นแหล่งอ้างอิงการแปลงระยะจริง ไม่เก็บค่าความยาวที่คำนวณได้ซ้ำทุกวัตถุ

ตัวอย่าง schema v2:

```json
{
  "scale": { "mode": "scaled", "denominator": 100 },
  "measurement": { "display_unit": "auto", "precision": 2 },
  "grid": {
    "enabled": true,
    "spacing": 1,
    "snap": true
  }
}
```

- scale.mode=`schematic|scaled`
- schematic ใช้ denominator=null เช่นเดิม และไม่แสดงระยะบนกระดาษเป็นความยาวจริง
- scaled ใช้ denominator เป็นจำนวนบวก เช่น 50 หมายถึง 1:50, 100 หมายถึง 1:100; เสนอ integer 1–10000 และให้ backend ยืนยัน
- display_unit=`cm|m|auto`; ค่าเริ่มต้นสำหรับแบบ scaled ใหม่เป็น auto
- auto: ค่าจริงน้อยกว่า 1 m แสดง cm, ตั้งแต่ 1 m แสดง m โดยเปรียบเทียบค่าก่อนปัดเศษ
- precision จำนวนตำแหน่งทศนิยมที่แสดง 0–3, default 2; ไม่ปัด geometry ที่จัดเก็บตาม precision นี้
- ขนาดบนกระดาษ mm × denominator = ระยะจริง mm; หาร 10 เป็น cm หรือหาร 1000 เป็น m
- กรอบหมุนใช้ width/height ก่อนหมุนเป็นขนาดด้าน ไม่ใช้ bounding box หลังหมุน
- ความยาว polyline เป็นผลรวมระยะ Euclidean ของแต่ละช่วงในพิกัดกระดาษ แล้วแปลงด้วย denominator
- measured_length_m ของ cable ยังคงเป็นค่าที่สำรวจจริงแยกจากความยาวจากแบบ ห้าม overwrite อัตโนมัติ

ตัวอย่างที่ต้องตรงกันทุกฝั่ง:

| แบบ | Geometry บนกระดาษ | ระยะจริง |
|---|---|---|
| 1:100 | กรอบ width=50 mm, height=30 mm | 5 m × 3 m |
| 1:50 | เส้นยาว 20 mm | 1 m |
| 1:100 | เส้นยาว 5 mm | 50 cm |
| schematic | เส้นยาว 20 mm | ไม่อ้างเป็นระยะจริง |

### Grid และระยะ snap

ยังเก็บ grid.spacing เป็น mm กระดาษเพียงค่าเดียว ไม่เก็บ world spacing อีกชุดที่อาจขัดกัน

Frontend ให้กรอกระยะ grid เป็น cm/m แล้วแปลงกลับตาม scale เช่น grid 10 cm จริงที่ 1:100 = spacing 1 mm กระดาษ Backend validate ค่าบวกตาม limits และคืนค่าเดิมโดยไม่ปัดให้เพี้ยน

ป้ายระยะชั่วคราวระหว่างลากเป็น UI ไม่ต้องส่ง request ต่อ pointermove; ส่ง document เมื่อบันทึกตามเดิม

## 6. การเปลี่ยนมาตราส่วนและความเข้ากันได้กับแบบเดิม

- แบบ v1 ยังคง schema เดิมและเป็น schematic ห้ามตีความอัตโนมัติว่าเป็น 1:100 หรืออ้างว่าขนาดห้องมีหน่วย m
- Frontend ที่รองรับ v2 เปิด v1 ได้ เมื่อเพิ่ม image/dimension หรือใช้ scale จริงจึงอัปเกรด document เป็น v2 ผ่าน PUT พร้อม expected_version
- Backend รับ v1 และ v2 ตาม schema ของแต่ละรุ่น ไม่แก้แบบเก่าในฐานข้อมูลย้อนหลังเพียงเพราะอ่าน
- เมื่อเปลี่ยน schematic เป็น scaled ให้ผู้ใช้เลือกมาตราส่วนและยืนยัน เพราะเป็นการกำหนดความหมายระยะจริงครั้งแรก ไม่ใช่การสอบเทียบข้อมูลหน้างาน
- เมื่อ scaled เปลี่ยนจาก 1:A เป็น 1:B เสนอค่าเริ่มต้น “รักษาระยะจริง” โดย frontend แปลง coordinates/width/height/polyline ด้วย A/B รอบ origin ของกระดาษ ก่อนส่งทั้ง document
- Grid.spacing และ dimension offset ที่ต้องรักษาระยะจริงแปลงตาม A/B; ค่า typography, stroke thickness, symbol convention และองค์ประกอบ title block/legend เป็นงานจัดหน้าที่ต้องระบุกติกากลางก่อน implement ไม่ให้ server เดา transform
- Backend ไม่ rescale document อีกครั้ง ตรวจ/เก็บ document ที่ frontend ส่งแบบ atomic และใช้ version conflict เดิม
- ขอให้ backend ยืนยันรูปแบบ scale/measurement และกติกา ownership ของการ rescale ว่าอยู่ frontend เพื่อไม่คูณมาตราส่วนซ้ำ

## 7. Schema v2: เส้นบอกระยะถาวร

ต้องแยกจากป้ายระยะระหว่างลาก ผู้ใช้เลือกเพิ่มเส้นบอกระยะลงแบบและให้พิมพ์ออกมาได้

ตัวอย่างที่เสนอ:

```json
{
  "id": "dimension-1",
  "type": "dimension",
  "layer_id": "dimensions",
  "start": { "x": 20, "y": 30 },
  "end": { "x": 70, "y": 30 },
  "axis": "aligned",
  "offset": 8,
  "font_size": 3,
  "style": { "stroke": "#222222", "stroke_width": 0.25 },
  "start_ref": null,
  "end_ref": null
}
```

- start/end/offset เป็น mm กระดาษ; font_size เป็น mm ของตัวอักษรบนกระดาษ
- axis=`aligned|horizontal|vertical`: วัดตามเส้นตรง, ผลต่าง x หรือผลต่าง y ตามลำดับ แล้วแปลงด้วย scale
- offset เป็น signed distance เพื่อวางเส้นบอกระยะด้านใดด้านหนึ่งของแนวอ้างอิง
- label ของระยะคำนวณจาก geometry + scale + measurement ไม่รับตัวเลขปลอมที่ขัดกับระยะจริงใน field label
- dimension อนุญาตเฉพาะ scale.mode=scaled ในรุ่นแรก; schematic ให้ใช้ text ปกติสำหรับข้อความอธิบาย
- ปลายทั้งสองต้องให้ระยะที่วัด > 0 ตาม axis; validate finite numbers และ coordinate bounds เดียวกับ schema
- start_ref/end_ref optional ใช้ `{object_id, anchor}` อ้าง box โดยเสนอ anchors เพิ่ม `top_left|top_right|bottom_left|bottom_right` เพื่อบอกความกว้าง/สูงได้ ไม่จำเป็นต้องขยาย cable anchors หากไม่ต้องการ
- Anchor ของ rotated box คำนวณหลัง rotation; frontend อัปเดต start/end เมื่อวัตถุย้าย/ปรับขนาด/หมุนใน action เดียวกัน
- ลบวัตถุที่อ้างอิงแล้วให้ frontend ถอด ref เป็น null โดยคงจุดล่าสุด หรือผู้ใช้ลบ dimension ด้วย; backend ปฏิเสธ dangling reference
- ไม่เพิ่ม support อ้าง polyline vertex ในรุ่นแรก เพื่อลดปัญหาจุดเปลี่ยน index ระหว่างแก้เส้น

ขอ backend ตอบรับชื่อ fields และ required/defaults ที่แน่นอนก่อน UI implement เส้นบอกระยะ

## 8. Capabilities และ errors ที่ต้องเพิ่ม

GET `/capabilities` เพิ่ม:

- schema_versions ที่รองรับ v1/v2 และ default_schema_version
- object_types image/dimension พร้อม required/optional ตาม schema จริง
- scale_modes, denominator bounds, display_units, precision bounds และ dimension anchors/axes
- image_formats, max_upload_bytes, max_image_pixels, max_image_dimension, จำนวน image objects สูงสุด และ asset retention policy
- ข้อจำกัดเดิม max_request_bytes ของ JSON แยกจาก multipart upload limit

Errors ใช้ envelope เดิมพร้อม error.field:

| HTTP | code ที่เสนอ | กรณี |
|---|---|---|
| 400 | INVALID_DOCUMENT | scale/dimension/image object ไม่ผ่าน schema |
| 400 | INVALID_IMAGE | decode ไม่ได้ ไฟล์เสีย หรือ dimensions เกินข้อจำกัด |
| 415 | UNSUPPORTED_IMAGE_TYPE | ชนิดไฟล์ไม่รองรับ |
| 413 | IMAGE_TOO_LARGE | ไฟล์เกิน upload limit |
| 404 | ASSET_NOT_FOUND | asset ไม่มี/ถูกลบ/ไม่เปิดเผยตามสิทธิ์ |
| 409 | ASSET_IN_USE | ขอ DELETE asset ที่ยังถูกอ้าง |
| 422 | INVALID_IMAGE_REFERENCE | document อ้าง asset ที่ไม่มีหรือใช้ไม่ได้ |

คง AUTH_TOKEN_*, AUTH_FORBIDDEN, VERSION_CONFLICT และ DOCUMENT_TOO_LARGE เดิม ส่วน missing asset ระหว่างอ่านแบบต้องไม่ทำให้ document ทั้งชุดโหลดไม่ได้

## 9. Browser/render/print integration

- รูป public โหลดข้าม origin ของ frontend ได้ตาม CORS ที่กำหนด และมี Content-Type ถูกต้อง
- หาก frontend export เป็นภาพผ่าน canvas ภายหลัง รูปต้องไม่ทำ canvas tainted; จึงขอ CORS สำหรับ image content ด้วย ไม่ใช่เฉพาะ JSON APIs
- งานพิมพ์ใช้ asset bytes เดียวกับที่แสดงใน editor ไม่ใช้ temporary Blob URL เป็น reference ถาวร
- GET metadata/content ของ temporary asset ตรวจสิทธิ์ได้ผ่าน authenticated fetch; ห้ามบังคับใส่ token ใน URL
- กำหนด caching ให้สอดคล้องกับนโยบายลบ/เลิก public ไม่ใช้ cache ระยะยาวที่ทำให้ข้อมูลยังเปิดผ่าน cache โดยไม่ตั้งใจหลังเปลี่ยนสถานะ

## 10. Fixtures และเกณฑ์ตรวจรับ

ขอ JSON Schema/capabilities เต็มและ fixtures:

1. แบบ v1 เดิมที่ยังเปิดและบันทึกตาม contract v1 ได้
2. แบบ v2 1:100 มีห้อง 5×3 m, รูปหนึ่งรูป และ dimension กว้าง/ยาว
3. แบบ v2 schematic มีรูปและแนวเดินสาย แต่ไม่มี dimension จริง

Acceptance:

- [ ] อัปโหลดจาก File และ clipboard Blob ผ่าน endpoint เดียวกันได้; decode/type/size validation ถูกต้อง
- [ ] บันทึกแบบใหม่พร้อม asset แล้ว GET/เปิด public/พิมพ์กลับมาเห็นรูปและตำแหน่งเดิม
- [ ] สำเนาแบบใช้ asset ร่วมได้ ลบรูปจากแบบหนึ่งไม่ทำให้แบบอื่นรูปหาย
- [ ] Temporary cleanup และ concurrent save ไม่ลบไฟล์ที่เพิ่งถูกอ้าง
- [ ] DELETE asset ที่มี reference ได้ 409; unauthorized upload/delete ได้ 401/403
- [ ] v1 ไม่ถูก rescale หรือเปลี่ยน schema ตอนอ่าน; v2 fields ไม่ถูกทิ้งเงียบ ๆ
- [ ] 1:100 กรอบ 50×30 mm แสดง 5×3 m; grid 1 mm เท่ากับ 10 cm จริง
- [ ] เปลี่ยน 1:100 เป็น 1:50 แบบรักษาระยะจริง Geometry ขยาย 2 เท่า แต่ค่าระยะจริงเดิม
- [ ] Dimension references มีจริง, ลบปลายอ้างอิงไม่ทำให้บันทึกข้อมูลไม่สมบูรณ์
- [ ] PUT ที่ validation ไม่ผ่าน/409 ไม่เปลี่ยน document, version หรือ asset references บางส่วน
- [ ] ภาษาไทย/รูป/มาตราส่วน/เส้นบอกระยะคงเดิมเมื่อ save → GET → render/print
- [ ] Backend แจ้งรุ่น/migrations/dev URL และผลทดสอบก่อนเปิดใช้ UI จริง

## 11. ลำดับส่งมอบที่เสนอ

1. ตกลง schema v2, defaults, limits, สูตรหน่วย และการรองรับ v1
2. ส่ง asset upload/content/reference lifecycle พร้อม fixtures เพื่อเริ่มทำ Ctrl+V และวางรูป
3. ส่ง scale/measurement และ dimension validation/capabilities เพื่อเริ่มเครื่องมือระยะจริง
4. ตรวจร่วม browser/print/version conflict/cleanup บน environment ที่ติดตั้งจริง

ไม่ขอให้ backend ปรับตำแหน่งข้อความใน title block และไม่อนุญาต migration ที่ตีความมาตราส่วนหรือแก้ geometry ของแบบเดิมอัตโนมัติในงานนี้
