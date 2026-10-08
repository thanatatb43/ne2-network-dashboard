# แผนปรับปรุงและตรวจรับ Backend — รูปภาพและมาตราส่วนแบบสำนักงาน

วันที่: 7 ตุลาคม 2569

อ้างอิง: `OFFICE_DRAWING_IMAGES_SCALE_BACKEND_RESPONSE.md`

สถานะ: แผนงานต่อจาก implementation ที่ backend รายงานแล้ว ไม่ใช่ผลทดสอบใหม่หรือคำสั่งให้ deploy/รัน migration บน production

## 1. เป้าหมาย

ทำให้ API schema v2 พร้อมเชื่อมกับ frontend จริง โดยปิดช่องว่างที่ยังไม่ได้ตรวจบน MySQL, การรับไฟล์ผ่าน environment จริง, การทำงานของ cleanup และ browser ต่าง origin ไม่ออกแบบ API ใหม่ซ้ำในส่วนที่ตกลงแล้ว

คงสิทธิ์เดิม: ดูแบบและรูปที่แบบ active อ้างได้โดยไม่ login; เพิ่ม/แก้ไข/ลบและอัปโหลดเฉพาะ super_admin, network_admin, computer_admin

## 2. สิ่งที่ถือว่ามี implementation แล้วตามเอกสาร

- Schema v1/v2, image/dimension, scaled/measurement และการปฏิเสธ downgrade
- Multipart upload PNG/JPEG/WebP พร้อม decode/normalize/limits
- เก็บ binary และ references ในฐานข้อมูล; save/version/audit เป็น transaction
- Temporary ownership, public active reference, detached retention และ maintenance cleanup
- Validation และ HTTP tests บน SQLite รวมผลที่รายงาน 61/61

รายการเหล่านี้ยังต้องตรวจเทียบ commit ที่ส่งมอบและ environment เป้าหมาย ไม่ถือว่าทดสอบ SQLite แทน MySQL concurrency แล้ว

## 3. งานลำดับแรก: ส่งมอบ contract และรุ่นโค้ดให้ครบ

### งาน backend

1. ส่งไฟล์จริง ไม่ใช่เฉพาะลิงก์ relative ใน Markdown:
   - `schema-v1.json`, `schema-v2.json`
   - `capabilities-v2.json`
   - `floor-plan.json`, `scaled-images-v2.json`, `schematic-images-v2.json`
2. ระบุ commit/release ที่มี routes, models, migrations, dependency สำหรับ decode ภาพ, tests และ cleanup script ครบ
3. ตรวจว่า capabilities ของรุ่นนั้นตรงกับ validator จริง รวม required/default/null, image limits และ dimension anchors
4. ระบุ response shape เต็มของ `data.assets` สำหรับ temporary/referenced/detached/missing และกรณี caller ไม่มีสิทธิ์
5. ระบุ dev URL ที่ frontend เข้าถึงได้และวิธีรับบัญชีทดสอบผ่านช่องทางทีม ไม่ใส่ token/password ในเอกสาร

### เกณฑ์จบ

Frontend โหลด fixtures หลังแทน site/asset IDs ได้ และสร้าง mock จาก contract จริงโดยไม่ต้องเดา defaults หรือชนิดข้อมูล

## 4. งานสำคัญก่อนเปิดใช้: ทดสอบ transaction บน MySQL

ใช้ฐานทดสอบแยกพร้อม migrations จริงและ connections คนละชุดสำหรับคำขอที่ทำพร้อมกัน ไม่ใช้ทะเบียน/แบบใช้งานจริงเป็น fixture

| กรณี | ผลที่ต้องได้ |
|---|---|
| PUT สองคำขอ expected_version เดียวกัน | สำเร็จหนึ่งคำขอ อีกคำขอ 409; document/version/audit ไม่ถูกเขียนทับ |
| Save อ้างรูปพร้อม cleanup รูปเดียวกัน | Save ชนะ lock แล้ว cleanup ต้องเห็น reference; cleanup ชนะก่อนให้ save ได้ 422 และ rollback ทั้งชุด |
| POST แบบใหม่อ้าง temporary asset พร้อม cleanup | ไม่มีแบบที่บันทึกสำเร็จแต่อ้าง bytes ที่ถูกลบโดย race |
| DELETE asset พร้อม save สร้าง reference | ไม่เกิด active reference ที่ชี้ bytes หาย; คำขอที่แพ้ได้ error ตาม contract |
| Soft-delete แบบสุดท้ายพร้อมสร้างสำเนาที่ใช้รูปเดียวกัน | คำนวณ active references ถูกต้อง ไม่ลบรูปที่สำเนาใหม่ใช้ |
| ถอดรูปแล้ว Undo ขณะ cleanup ทำงาน | หากอยู่ใน retention ต้องอ้างกลับได้; หากถูกลบจริงต้อง error ชัดและไม่บันทึกบางส่วน |
| Audit insert ล้มเหลว | document/version/references และการเปลี่ยน state rollback พร้อมกัน |
| ลำดับ asset IDs ในสองคำขอสลับกัน | Lock ตามลำดับ ID กลาง ไม่ทำให้ deadlock จากลำดับการล็อกที่ต่างกัน |

หากพบ deadlock/lock timeout ให้กำหนดนโยบาย rollback และ error ที่ UI retry ได้อย่างชัดเจน การ retry ภายใน server ต้องเป็นทั้ง transaction และไม่สร้าง version/audit ซ้ำ

### เกณฑ์จบ

มี automated integration tests บน MySQL ที่รันทวนได้ พร้อมบันทึก MySQL version, isolation level และผลทุก race case ไม่อาศัยการส่งคำขอพร้อมกันโดยไม่มีการควบคุมจังหวะจนไม่เกิดการแข่งขันจริง

## 5. ทดสอบการอัปโหลดผ่าน environment จริง

### Configuration ที่ผู้ดูแลต้องตรวจ

- ตาราง binary รองรับขนาด output สูงสุดจริง และ connection/driver ส่ง binary ได้โดยไม่เปลี่ยน bytes
- `max_allowed_packet` ตามคำแนะนำ backend อย่างน้อย 32 MiB โดยตรวจทั้งเส้นทางอ่าน/เขียนจริง
- Proxy limit มากกว่า 10 MiB พร้อม multipart overhead; ไม่ตั้งเท่าขนาดไฟล์พอดี
- JSON limit 2 MiB ยังมีผลกับ document แยกจาก multipart limit
- Timeout และ memory ของ decoder รองรับภาพใกล้ 25 ล้าน pixels ภายใต้จำนวน upload พร้อมกันที่คาดว่าจะใช้

### กรณีทดสอบ

- PNG/JPEG/WebP ปกติ, transparency, EXIF orientation และ metadata stripping
- ขนาดต่ำกว่า/เท่ากับ/สูงกว่าเพดาน bytes รวม output หลัง normalize
- เกิน pixels/dimension, MIME ปลอม, ไฟล์เสีย, animated PNG/WebP และ multipart หลายไฟล์หรือมี fields เกิน
- Upload หลายคำขอพร้อมกันเพื่อประเมิน memory/latency ไม่ปล่อย decoder ใช้ทรัพยากรจน service หลักหยุดตอบ
- Client ตัดการเชื่อมต่อกลาง upload และ decode ล้มเหลวต้องไม่ทิ้ง record ที่ API รายงานว่าใช้ได้ทั้งที่ไม่มี bytes

### เกณฑ์จบ

Response/status ตรง contract ผ่าน proxy จริง และมีข้อมูลการใช้ทรัพยากรพอให้ผู้ดูแลตั้ง concurrency/rate limit หากจำเป็น ไม่กำหนดจำนวนพร้อมกันโดยไม่มีผลวัด

## 6. ตรวจสิทธิ์และวงจร public/private

- Temporary asset: uploader ที่ยังมี role เขียนหรือ super_admin เท่านั้นอ่าน/ใช้/ลบได้
- รูปที่เคยถูกอ้าง: สาม role เขียนใช้ซ้ำได้ตามนโยบายที่ตกลง
- Anonymous อ่านได้เมื่อมี active reference อย่างน้อยหนึ่งแบบเท่านั้น
- Soft-delete แบบสุดท้ายแล้ว request ใหม่แบบ anonymous ต้องไม่ได้ bytes; ถ้ามีแบบ active อื่นใช้ยังอ่านได้
- GET แบบที่รูปขาดยังคืน document และ metadata สถานะ missing ไม่ทำให้ทั้งแบบ 500
- Role อื่นต้องไม่ใช้รูป private ผ่าน POST/PUT, equipment lookup หรือ endpoint metadata/content
- Cache-Control/no-store และ nosniff ต้องอยู่ทั้ง success/error ตามนโยบาย assets; ไม่ใช้ ETag/304 หรือ proxy cache ข้าม authorization
- บันทึกไว้ชัดเจนว่ารูปที่เคยเปิด public และถูกดาวน์โหลดไปแล้วไม่สามารถเรียกคืนจากผู้รับได้ การเลิก public มีผลกับการเข้าถึงครั้งถัดไป

### เกณฑ์จบ

มี HTTP tests ครอบคลุม anonymous/uploader/admin อื่น/super_admin/role อื่น/token หมดอายุ และทั้ง metadata กับ content

## 7. Cleanup และการปฏิบัติการ

### สิ่งที่ต้องจัดเตรียม

1. กำหนดผู้รับผิดชอบและ schedule ของ `cleanup-office-drawing-images.js` หลัง migrations สำเร็จ
2. เพิ่มหรือยืนยันโหมด dry-run แสดงจำนวน candidates ตาม temporary/detached และช่วงอายุ โดยไม่ลบ bytes
3. ใช้เวลาของ server/DB ที่สอดคล้องกัน: temporary อย่างน้อย 24 ชั่วโมง, detached อย่างน้อย 7 วันจากการถอด reference สุดท้าย
4. ป้องกันงาน cleanup ซ้อนกันด้วยกลไกที่เหมาะกับ deployment และยังตรวจ references ภายใต้ transaction ทุกครั้ง
5. จำกัด batch ตาม contract 100 candidates ต่อรอบ พร้อมแนวทางประมวลผล backlog โดยไม่ล็อกนาน
6. เก็บผลจำนวน scanned/deleted/skipped/failed และระยะเวลา โดยไม่ log binary, token หรือข้อความส่วนบุคคลที่ไม่จำเป็น
7. ระบุวิธีหยุด schedule เมื่อพบปัญหาและวิธีตรวจ candidate โดยไม่จำเป็นต้องลบข้อมูลทดสอบซ้ำด้วยมือ

### เกณฑ์จบ

Dry-run และ execution ให้ผลตรงกันเมื่อไม่มีการเปลี่ยนข้อมูล; รูปใน retention/มี active reference ไม่ถูกลบ และ cleanup ล้มเหลวกลางรอบไม่ทำข้อมูลค้างครึ่ง transaction

## 8. Migration, backup และ rollback

- ตรวจ dependency migrations `create-office-drawings` ก่อน `create-office-drawing-images`
- ทดสอบติดตั้งจากฐาน v1 ที่มีแบบเดิม และจากฐานใหม่ โดยไม่แก้ geometry/schema_version ของแบบเก่า
- Backup/restore ต้องครอบคลุม OfficeDrawings, OfficeDrawingImages, OfficeDrawingImageRefs และ audit ที่เกี่ยวข้องแบบสอดคล้องกัน
- ทดลอง restore ในฐานทดสอบ แล้วตรวจเปิดแบบ/โหลด bytes/public references/แก้ไขต่อได้จริง
- เมื่อมี document v2 แล้ว ห้าม rollback application ไป client/server ที่ทิ้ง fields v2 หรือสั่ง migration down เพื่อลบตารางภาพโดยไม่มีกระบวนการรักษาข้อมูล
- แผนถอยกลับที่เสนอ: ปิดการเขียน v2/การอัปโหลดและ cleanup ชั่วคราว พร้อมรักษา reader ที่รองรับ v2 และข้อมูลเดิมไว้ จากนั้นแก้รุ่นใหม่
- บันทึกขนาด storage และแนวทางติดตามการเติบโต เนื่องจากรูปอยู่ใน DB และมีผลต่อ backup/replication

## 9. ตรวจมาตราส่วนและ schema โดยไม่ทำงานซ้ำกับ frontend

Backend ตรวจและเก็บข้อมูล ไม่คำนวณ geometry ใหม่ระหว่าง save:

- v1 round-trip คงเดิม; v2 ต้องมี measurement; downgrade ถูกปฏิเสธ
- scaled denominator เป็น integer 1–10000, schematic denominator=null
- dimension ใช้เฉพาะ scaled, axis/refs/positive length ตรง contract
- required image fields และ asset ownership ถูกตรวจพร้อมบันทึก references
- rejected request ไม่เปลี่ยน version/document/reference/audit บางส่วน
- ยืนยันว่าการเปลี่ยนมาตราส่วนที่ frontend ส่งไม่ถูก server คูณซ้ำหรือปัด geometry ตาม display precision
- Fixtures มีผลคาดหวัง 50×30 mm ที่ 1:100 = 5×3 m และเปลี่ยนเป็น 1:50 โดย geometry 100×60 mm ยังมีระยะจริงเดิม

ค่าแสดง cm/m, anchor transform, การลาก, Ctrl+V, การจัด title block และงานพิมพ์เป็น frontend ไม่เพิ่ม server endpoint คำนวณทุกครั้งที่ลาก

## 10. Browser integration ร่วมกับ frontend

| การตรวจ | Backend เตรียม | Frontend ตรวจ |
|---|---|---|
| Clipboard/File upload | Routes, token, proxy limits | File/Blob multipart และข้อความ error |
| รูป private | Authenticated content response | Fetch → Blob URL และ revoke เมื่อเลิกใช้ |
| รูป public | CORS และ content headers | โหลดรูปข้าม origin และเปิดแบบโดยไม่มี token |
| Print | Bytes/MIME/metadata ที่ถูกต้อง | รอภาพ/font พร้อม, PDF ภาษาไทย/รูป/กรอบครบ |
| Canvas หากใช้ export ภาพ | CORS content ที่เหมาะสม | ตรวจว่า canvas ไม่ tainted |
| Session หมดอายุ | AUTH_TOKEN_* ตาม contract | รักษา draft ไม่บันทึกซ้ำ/ไม่ทำข้อมูลหาย |
| Save conflict | 409 และ transaction จริง | ไม่ retry ด้วย version ใหม่เพื่อทับงานคนอื่น |

การส่ง CORS headers ผ่าน HTTP tests ยังไม่ถือว่าผ่าน browser acceptance

## 11. ลำดับส่งมอบ

| ลำดับ | งาน | เงื่อนไขผ่าน |
|---|---|---|
| 1 | Contract/fixtures/commit/dev environment | Frontend อ่าน API และสร้าง mock ได้ครบ |
| 2 | MySQL integration และ race cases | ไม่เกิด lost update/dangling bytes/partial commit |
| 3 | Upload limits/สิทธิ์/backup-restore | ใช้ไฟล์จริงผ่าน proxy และกู้ข้อมูลกลับได้ |
| 4 | Cleanup dry-run/schedule/monitoring | มีผู้ดูแลและพิสูจน์ retention/reference safety |
| 5 | Browser/render/print ร่วม | บันทึกผลทดสอบบนรุ่นที่จะเปิดใช้ |
| 6 | เปิดใช้งานตามกระบวนการของทีม | ยืนยัน migrations/config และ rollback plan พร้อม |

เริ่ม frontend prototype จาก schema ได้ระหว่างงาน 2–4 แต่ยังไม่ประกาศฟีเจอร์รูปภาพพร้อมใช้งานจริงจนผ่านการตรวจรับที่เกี่ยวข้อง

## 12. รายการตรวจรับสุดท้าย

- [ ] ส่ง schemas/capabilities/fixtures ครบ และตรง validator รุ่นที่ติดตั้ง
- [ ] ระบุ commit, MySQL version, migration state และ dev URL ที่ทดสอบ
- [ ] MySQL concurrency tests ผ่าน รวม save-vs-cleanup และ DELETE-vs-reference
- [ ] Upload limits และ decoder behavior ผ่าน proxy จริง
- [ ] สิทธิ์ temporary/referenced/detached และ public หลัง soft-delete ถูกต้อง
- [ ] Cleanup ผ่าน dry-run/retention tests มี schedule/ผู้รับผิดชอบชัดเจน
- [ ] Backup/restore รักษา document/bytes/references ได้ครบ
- [ ] แบบ v1 ไม่เปลี่ยนและ v2 ไม่ถูก downgrade
- [ ] Frontend browser tests ภาพ/clipboard/print/CORS ผ่าน
- [ ] บันทึกข้อจำกัดคงเหลือแยกจากผล automated tests และไม่ใช้ผล SQLite รับรอง MySQL โดยตรง

ผลส่งมอบที่ต้องการคือเอกสารตรวจรับพร้อมหลักฐานของรุ่นจริง ไม่ใช่เพียงแก้สถานะในเอกสารเดิมว่า “พร้อมใช้งาน”
