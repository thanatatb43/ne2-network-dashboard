# แผนปรับปรุงหน้าจัดการอุปกรณ์สำนักงานและฟอร์มอุปกรณ์ร่วม

วันที่: 27 กันยายน 2026

หน้าหลักของงาน: `/management/computers/:siteId` เช่น `/management/computers/1`

หน้าที่ต้องใช้ร่วมกัน: `/equipment/new/edit`, `/equipment/:id/edit` และทางเข้าเพิ่มอุปกรณ์จากคลัง

สถานะ: แผนก่อนดำเนินการ ยังไม่แก้ implementation หรือเพิ่ม API

ตรวจจาก [OfficeEquipmentManagement.jsx](src/components/OfficeEquipmentManagement.jsx), [EquipmentEdit.jsx](src/components/EquipmentEdit.jsx), [Management.jsx](src/components/Management.jsx), [App.jsx](src/App.jsx), [EquipmentEdit.css](src/components/EquipmentEdit.css) และ [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) ยังไม่ได้ทดสอบ browser หรือยืนยัน response backend สดในงานวางแผนนี้

## 1. ข้อเสนอหลัก

ใช้ **EquipmentForm ชุดเดียว** สำหรับเพิ่มและแก้ไขทุกทางเข้า โดยแยก “บริบทสำนักงานและข้อมูลแนะนำเครือข่าย” ออกจากข้อมูลอุปกรณ์ที่บันทึก ให้ส่วนเครือข่ายใช้ได้ทั้งหน้าสำนักงานและหน้าฟอร์มปกติเมื่อรู้สำนักงานแล้ว

ใช้ EquipmentEdit เป็นฐานพฤติกรรม เพราะมีรูปภาพ การตรวจสถานะยืม และ flow สร้างแล้วอัปโหลดต่ออยู่แล้ว นำข้อมูลวงเครือข่าย/ช่วง IP จาก OfficeEquipmentManagement มารวมเป็น section กลาง ไม่คัดลอก JSX ของสองหน้ามาต่อกันและคง save handler สองชุด

รอบแรกคงหน้าฟอร์มภายใน `/management/computers/:siteId` เพื่อลดผลต่อ navigation และให้สำนักงานชัดเจน ใช้ component กลางเดียวกับหน้า EquipmentEdit; ไม่จำเป็นต้องเปลี่ยนทุกทางเข้าไป route ใหม่

**API ใหม่ยังไม่จำเป็นสำหรับการรวมฟอร์มและปรับ layout** โดยใช้ network_ip จาก endpoint เดิมได้ มีข้อเสนอ API แยกข้อมูลเครือข่ายเป็นทางเลือกในส่วน 9 ซึ่งต้องแจ้งและตกลงก่อนพัฒนา

## 2. ความแตกต่างที่พบและสิ่งที่ต้องรักษา

| ความสามารถ | ฟอร์มในหน้าสำนักงาน | ฟอร์มปกติ EquipmentEdit | เป้าหมาย |
|---|---|---|---|
| ข้อมูลทั่วไป/เครือข่าย/ทรัพย์สิน/ผู้ถือครอง/สัญญา/สถานที่/หมายเหตุ | มี field ส่วนใหญ่เหมือนกัน แต่เรียงเป็น grid ยาว | แบ่ง section แล้ว | ใช้ field definitions และลำดับ section เดียวกัน |
| สำนักงาน | บังคับจาก selectedSiteId ตอนส่งข้อมูล | เลือกสำนักงานได้; create รับ defaultSiteId | นโยบาย explicit: locked เมื่ออยู่ในสำนักงาน, selectable ในฟอร์มปกติ |
| ข้อมูลวงเครือข่าย | main, secondary_172, secondary_10, dhcp_range | ไม่มี section นี้ | แสดงจากสำนักงานที่เลือกในทุกทางเข้า |
| ช่วง IP แนะนำ | IP_RANGE_GROUPS + จับคู่ประเภท/แผนก และตารางเต็ม | ไม่มี | ย้ายเป็น section/helper กลาง โดยระบุว่าเป็นแผนอ้างอิง ไม่ใช่ IP ว่าง |
| สถานะ | select เพียง5ค่า | combo มีสถานะเพิ่มเติมและพิมพ์เองได้ | ใช้แหล่ง options กลางและรักษาค่าเก่าทั้งหมด |
| ค่าเริ่มต้นสถานะ | create ตั้ง “ใช้งาน” | create ยังไม่ตั้งสถานะใน initial form | ใช้ default ตาม context เดิมก่อน อย่าเปลี่ยนคลัง/สำนักงานพร้อมกันโดยไม่ตรวจ business rule |
| หมายเหตุ | input บรรทัดเดียว | textarea | textarea แบบเดียวกัน |
| รูปอุปกรณ์/รูปสถานที่ | ไม่มีในฟอร์ม | มี upload/delete รูปอุปกรณ์และ upload รูปสถานที่ | นำมาใช้ร่วมกันทุกทางเข้า หลังมี equipment ID |
| ตรวจรายการยืมค้าง | ไม่เห็นการตรวจใน save flow | อ่าน loans และล็อกสถานะเมื่อยืมค้าง | ใช้ guard เดียวกัน; ยืนยัน backend บังคับด้วย |
| validation/payload | IP/MAC และ field whitelist ของตัวเอง | validation และ whitelist อีกชุด | รวม normalize/validate/serialize ไม่ส่ง record ทั้งก้อน |
| หลังสร้าง | ปิดฟอร์มและ refresh รายการ | เปลี่ยนเป็น edit ID จริง เพื่ออัปโหลดรูปต่อ | มีขั้นสร้างสำเร็จ → ทำรูปต่อ หรือกลับรายการ ห้าม POST ซ้ำ |

ฟีเจอร์หน้าสำนักงานที่ต้องคง: ค้นหา/กรองประเภท, ขนาดหน้า10/25/50/100, pagination, ดูรายละเอียด, QR, ประวัติผู้ถือครอง, แก้ไข, ลบตามสิทธิ์ และ Excel **ทุกอุปกรณ์ในสำนักงาน** ไม่ใช่เฉพาะหน้าปัจจุบันหรือผลกรอง

## 3. โครงสร้างโค้ดที่เสนอ

ชื่อด้านล่างเป็นโครงสร้างเป้าหมาย ไม่ใช่ component ที่มีอยู่แล้ว

```text
src/components/equipment-form/
  EquipmentForm.jsx          # section, controls, errors, actions ร่วม
  EquipmentForm.css          # scoped responsive styles
  equipmentFields.js         # definitions/options/defaults/whitelist
  equipmentValidation.js     # normalize, validate, serialize
  useEquipmentEditor.js      # load/create/update, dirty state, loan guard
  EquipmentMediaSection.jsx  # upload/delete และ partial refresh
  SiteNetworkSection.jsx     # network context, suggestions, reference table
  ipAllocationReference.js   # ตารางอ้างอิงเดิม + matching/display helpers
  useSiteNetwork.js          # adapter อ่าน network_ip ของสำนักงาน
```

- EquipmentEdit เป็น page wrapper: อ่าน ID/defaultSiteId/return context แล้วเรียก form ร่วม
- OfficeEquipmentManagement รับผิดชอบรายการ สำนักงาน export และเลือก add/edit; ส่ง context เข้า form เดียวกัน ไม่เก็บอีกชุดของ formFields/handleSave
- useEquipmentEditor เป็นเจ้าของ draft/saved baseline/loading/saving/loan state ส่วน media hook อัปเดตเฉพาะ photos/storage_photo/updatedAt ห้ามทับ draft field อื่น
- ใช้คอมโพเนนต์ dropdown ของระบบที่เหมาะกับ semantics: ประเภท/แผนก/status เป็น editable combo ตามพฤติกรรมเดิม ส่วนสำนักงานต้องเลือก ID จริง ห้ามเอาข้อความที่พิมพ์ไม่ตรงรายการมาเป็น site ID
- สกัดของร่วมเท่าที่ใช้จริง ไม่ต้องปรับ StockManagement bulk import หรือทุก modal ทั้งระบบในคราวเดียว

สัญญา props โดยย่อ:

```text
EquipmentForm
  mode: create | edit
  equipmentId: string | null
  context: {
    source: office | equipment | stock,
    siteId: string | null,
    sitePolicy: locked | selectable,
    returnTo: internal route
  }
  user, token
  onCreated(record), onSaved(record), onCancel()
```

สร้างแล้ว wrapper เปลี่ยน ID/mode โดยไม่ remount จน draft หาย และไม่สร้าง EquipmentForm สองชุดซ้อนกัน หลังย้ายครบจึงลบ implementation ซ้ำออก

## 4. Layout และ flow

### หน้ารายการอุปกรณ์ของสำนักงาน

- Header: h1 “อุปกรณ์สำนักงาน” + ชื่อสำนักงาน/จังหวัด, ปุ่มกลับรายชื่อสำนักงาน, “เพิ่มอุปกรณ์” เป็น primary action และ “ส่งออก Excel ทั้งสำนักงาน” เป็น secondary
- แยก toolbar จาก header: ค้นหา, ประเภท, ล้างตัวกรอง; ขนาดหน้าและช่วงรายการอยู่ footer ใช้คำไทยแทน All/Show/Export
- ใช้ ListPage.css ให้ control สูงอย่างน้อย44px, panel16px, controls8px, spacing16–24px และ focus3px ไม่รับมุมใหญ่จาก glass เดิม
- Desktop ตารางแถวปกติหนึ่งบรรทัด ชื่อยาว ellipsis พร้อม title และทางเปิดข้อมูลเต็ม ชื่อ/label ทุกคอลัมน์ตรงกับค่า ตัวเลขชิดขวา คำสั่งมี accessible name
- Mobile ใช้ cards ที่อ่านชื่อ สถานะ ประเภท IP และคำสั่งหลักครบ รายละเอียดรองเปิดดูเพิ่มได้; คง QR/ประวัติ/แก้ไข/ลบ ไม่ซ่อน feature จนหาไม่เจอ
- การเปิดรายละเอียด/QR/ประวัติคงความสามารถเดิม ถ้าเปลี่ยนไปใช้หน้า EquipmentDetails ต้องตรวจ feature parity และ return context ก่อนเลิก modal เดิม
- modal ที่ยังใช้ต้องมีชื่อ dialog, focus trap, Escape, return focus และขนาดไม่ล้นมือถือ; success ใช้ toast/inline feedback แทน modal สำเร็จซ้อนทุกครั้ง ส่วนลบยังต้องยืนยัน

### ฟอร์มกลาง

ลำดับ section เดียวกันทั้งสองหน้า:

1. **ข้อมูลทั่วไป:** ชื่อ ประเภท แผนก สถานะ และสำนักงาน
2. **เครือข่าย:** IP/MAC พร้อมวงสำนักงาน ช่วงแนะนำ และตารางอ้างอิงแบบพับได้
3. **ทรัพย์สินและผู้ถือครอง:** serial, asset number, ผู้ถือครอง, รหัสพนักงาน
4. **สถานที่และรูปภาพ:** สถานที่ติดตั้ง/จัดเก็บ รูปอุปกรณ์ รูปสถานที่
5. **ผู้ขายและสัญญา:** vendor, เลขสัญญา, วันเริ่ม/หมดอายุ
6. **หมายเหตุ:** textarea เต็มแถว

Desktop ใช้สองคอลัมน์เมื่อพื้นที่เนื้อหาพอ section เครือข่าย/รูป/หมายเหตุกินเต็มแถวเมื่อเนื้อหาต้องการ หลีกเลี่ยงวาง21 field แบบ auto-fit grid โดยไม่มีหมวด Mobile เป็นคอลัมน์เดียวตามลำดับเดียวกัน

สำนักงาน locked แสดงชื่อและจังหวัดแบบอ่านอย่างเดียว พร้อมคำอธิบาย “เพิ่มอุปกรณ์ให้สำนักงานนี้” ไม่ใช้ dropdown disabled ที่ดูเหมือนเสีย ฟอร์มปกติให้เปลี่ยนสำนักงานแล้วโหลด network context ใหม่ โดยไม่ล้าง IP/MAC หรือข้อมูลที่พิมพ์อัตโนมัติ หากแก้ไข record ของสำนักงานอื่นผ่าน context ที่ locked ให้หยุดพร้อมแจ้งข้อมูลไม่ตรงกัน ไม่ย้ายสำนักงานเงียบ ๆ

Footer มี “บันทึก” primary และ “ยกเลิก/กลับรายการ” secondary ไม่ใช้แดงสำหรับ cancel ปกติ; desktop ทำ sticky ได้เมื่อไม่ทับ field/focus ส่วน mobile ต้องไม่บังเนื้อหาเมื่อ keyboard เปิด

ทุก field มี label/required/คำอธิบาย ใช้ height/padding/font เดียวกันทั้ง input/select/combobox แสดง filled highlight สำหรับค่าที่กรอก/restore (ไม่สื่อว่าบันทึกแล้ว) และ error state แยกสี/ข้อความ ไม่มี outline:none โดยไม่มี focus ทดแทน

## 5. ส่วนข้อมูลเครือข่ายที่ต้องนำมาใช้ร่วมกัน

- แสดงเฉพาะวงที่มีข้อมูลจริง `null`, ค่าว่าง และ `-` ไม่ใช่วงที่ใช้ได้; ถ้าไม่รู้ subnet ให้แสดง “ยังไม่มีข้อมูลวงเครือข่าย” ไม่สร้างตัวอย่างที่ดูเหมือน IP จริง
- คงตาราง IP_RANGE_GROUPS เดิม แต่ย้ายออกจาก JSX เป็นแหล่งเดียว พร้อมอธิบายว่าเป็นแผนจัดสรร ไม่ใช่การตรวจความว่างหรือการจอง
- ห้ามต่อ prefix3 octets แล้วรับรอง CIDR โดยอัตโนมัติ โค้ดเดิมสมมติ /24; หากไม่มี prefix length ที่ยืนยัน ให้ติดป้ายสมมติฐาน/แสดงเลขท้ายอ้างอิงและไม่บังคับ validation ตามช่วงนั้น
- ค่าปัจจุบันมีช่วงอ้างอิงทับกัน เช่น AP/Voice/Printer บางวง และ usableIPs บางรายการไม่ตรงกับการนับรวมปลายช่วง จึงต้องให้เจ้าของแผนยืนยันก่อนใช้คำนวณ “จำนวนว่าง/ใช้ได้” ห้าม frontend ปรับเลขเองแล้วถือเป็นนโยบายใหม่
- matching เดิมเป็น substring สองทาง อาจแนะนำหลายกลุ่มหรือ match ข้อความสั้นผิดกลุ่ม เสนอ exact match หลัง normalize และ alias ที่ยืนยันแล้ว; ถ้าไม่ชัดให้แสดงรายการกลุ่มอ้างอิงให้ผู้ใช้เลือกดู ไม่เลือก IP ให้เอง
- เปลี่ยนประเภท/แผนกแล้วเปลี่ยนเฉพาะคำแนะนำ ไม่เขียนทับ IP ที่กรอก กรณีหลายกลุ่มให้แสดงแยกชัดเจน
- ตารางเต็มพับได้ `aria-expanded` และเลื่อนเฉพาะกรอบตาราง; mobile มีรายการต่อกลุ่มให้อ่านครบ ไม่ลดฟอนต์จนเล็ก
- แสดง loading/error/retry ของข้อมูลเครือข่ายแยกจากฟอร์ม ความล้มเหลวของคำแนะนำไม่ควรล้าง draft หรือปิดกั้นการบันทึกข้อมูลที่ถูกต้อง
- หากเพิ่มปุ่มคัดลอกช่วง/IP ต้องไม่เรียกว่า “ใช้ IP นี้” และรองรับ HTTP deployment ที่ clipboard API อาจใช้ไม่ได้

## 6. กฎข้อมูล การบันทึก และ media

- field whitelist กลางครอบคลุมชื่อ/ประเภท/แผนก/status/IP/MAC/serial/asset/owner/employee/storage/vendor/contract dates/notes/pea_site_id; ห้ามส่ง read-only network_ip, photos array, loans, ID หรือ nested device object ใน PUT
- คง form-urlencoded สำหรับ POST/PUT เดิม; ใช้ nullish semantics ไม่ใช้ `value || ''` จนค่าที่มีความหมายหาย และตกลง empty/null ของ date กับ backend ก่อนเปลี่ยน
- ใช้ IP/MAC validation เดียวกันทั้งสองทางเข้า คงกฎ backend ที่ทราบอยู่ก่อน เพิ่ม inline error และ focus ช่องผิดแรก; ถ้าจะแปลง MAC เป็น uppercase ให้ผู้ใช้เห็นค่าที่ normalize ไม่เปลี่ยนข้อมูลลับหลัง
- status ใช้ชุดกลางรวมสถานะปัจจุบัน เช่น รอจ่ายคืน/รอแจกคืน/รอรับโอน/รอส่งคืน/จัดเก็บ/active/อื่นๆ และค่าจาก record ที่อยู่นอก options เพื่อไม่ให้ข้อมูลเก่าถูกเขียนทับเมื่อบันทึก field อื่น ไม่สร้าง status ใหม่จาก free text โดยไม่ยืนยันว่า API รองรับ
- เมื่อโหลด loans ยังไม่เสร็จ/ล้มเหลว ห้ามตีความว่า “ไม่มีการยืม” ให้ state checking/unknown/clear/open และ retry กำหนดวิธี save field อื่นโดยไม่เปลี่ยน status ตาม contract จริง; หาก PUT บังคับส่ง status ให้รอการตรวจสำเร็จก่อนบันทึก
- Backend ต้องบังคับเงื่อนไข loan ระหว่าง save ด้วย เพราะอาจถูกยืมหลัง frontend ตรวจแล้ว; แสดง conflict พร้อมเก็บ draft ไม่ bypass guard
- ตรวจวันสัญญาเริ่มไม่เกินหมดอายุ; record เก่าที่ขัดแย้งต้องแจ้งชัดและตกลงวิธีแก้ ไม่ทำให้ผู้ใช้เสียข้อมูล field อื่น
- สิทธิ์เพิ่ม/แก้เดิม: super_admin, computer_admin, network_admin, operator; ลบเฉพาะ super_admin คง policy และตรวจ401/403 แม้ปุ่มผ่านเงื่อนไข frontend
- สร้างก่อนอัปโหลดรูป เพราะต้องมี ID จริง คงข้อจำกัดรูปอุปกรณ์5รูป/ไฟล์5MB ตามโค้ดเดิม และยืนยันกับ backend; คงชนิดไฟล์ที่รองรับ
- บันทึก create สำเร็จแล้วเข้าสู่ edit ของ ID ใหม่ มีทาง “เพิ่มรูปต่อ”/“กลับรายการ” ไม่ reset form หรือ POST ซ้ำเมื่อ upload ล้มเหลว
- ระบุชัดว่าการอัปโหลด/ลบรูปเป็นการบันทึกทันทีแยกจากปุ่มบันทึกข้อมูล ยกเลิกฟอร์มไม่ย้อนคืนรูปที่บันทึกแล้ว
- upload/delete เสร็จ merge เฉพาะ media fields + updatedAt เพื่อ cache bust ไม่ refetch ทับชื่อ/notes ที่ยังไม่บันทึก; ทดสอบทั้งภาพอุปกรณ์และภาพสถานที่
- คงการแจ้งเตือนเมื่อกดบันทึกขณะ upload pending ตามพฤติกรรมเดิม โดยอธิบายว่าข้อมูลข้อความกับรูปเป็นคนละคำขอ ป้องกัน double submit และไม่แสดงบันทึกครบเมื่อบางส่วนล้มเหลว
- หาก POST สำเร็จแต่ response ขาด ID ให้แสดงว่าสร้างแล้วแต่ยังเปิดรูปต่อไม่ได้ ห้าม retry POST อัตโนมัติ; network timeout ที่ไม่ทราบว่าบันทึกสำเร็จหรือไม่ต้องไม่อ้างว่าสร้างไม่สำเร็จแน่นอน

## 7. Navigation และการจำบริบท

- เก็บ siteId ใน route; filters/search/page/pageSize อยู่ query หรือ session ต่อ site ตามรูปแบบหน้ารายการเดิม ใช้ version และ fallback เมื่อ storage ใช้ไม่ได้
- Back จากเพิ่ม/แก้ไขคืนหน้าสำนักงานและเงื่อนไขเดิม ไม่กลับคลังหรือหน้าอุปกรณ์โดยไม่มีเหตุผล; หลัง save refresh รายการกับ summary โดยแยก “บันทึกสำเร็จ แต่โหลดรายการใหม่ไม่สำเร็จ”
- เมื่อสร้าง record ไม่ตรง filter เดิม แจ้งว่าบันทึกแล้วและให้ “ดูอุปกรณ์ที่สร้าง” อย่าล้าง filter โดยไม่บอกหรือทำให้คิดว่าบันทึกไม่สำเร็จ
- ฟอร์มมี dirty baseline; ก่อนทิ้ง draft เมื่อ cancel/เปลี่ยนสำนักงานต้นทาง/Back ให้ guard กลางสำหรับ navigation ในแอปและ beforeunload เท่าที่ browser รองรับ ไม่ดัก history จนวนกลับไม่ได้
- เก็บ draft ใน session เฉพาะเมื่อจำเป็น แยกผู้ใช้+mode+equipment/site ID มีอายุ/ปุ่มล้าง ไม่เก็บ token, File หรือ blob ใน storage; media ที่ส่งแล้วเป็น server state แยกจาก draft
- deep link ฟอร์มปกติพร้อม default site ต้องอ่านได้หลัง reload ไม่พึ่ง state `newEquipmentDefaultSiteId` ใน App เพียงอย่างเดียว เสนอ query `site_id` และ return context ภายในแอปที่ validate แล้ว ไม่ใช้ return URL ภายนอก
- สลับ site/record ระหว่าง request ต้อง abort/ignore response เก่า โดยเฉพาะ network context ห้ามข้อมูลสำนักงาน A แสดงใต้สำนักงาน B

## 8. API เดิมที่ใช้ได้

เส้นทางต่อจาก VITE_API_BASE_URL อ้างอิงการเรียกจาก frontend ต้องยืนยัน shape/สิทธิ์จาก response จริงก่อน implementation

| Endpoint | หน้าที่ |
|---|---|
| GET `/api/pea-sites/summary` | รายชื่อสำนักงานและ summary เดิม |
| GET `/api/pea-jobs/sites` | ตัวเลือกสำนักงานที่ฟอร์มปกติใช้ ตรวจความต่างกับ summary และเก็บ ID เป็น string ให้สม่ำเสมอ |
| GET `/api/office-equipment/site/:siteId` | data รายการอุปกรณ์ + network_ip ที่ใช้เป็นข้อมูลบริบทได้ |
| GET `/api/office-equipment/:id` | โหลดข้อมูลแก้ไข/รูป/updatedAt; ต้องใช้ record เต็ม ไม่สมมติว่า list row มี field ครบ |
| POST `/api/office-equipment` | สร้าง คืน ID จริงสำหรับอัปโหลดต่อ |
| PUT `/api/office-equipment/:id` | บันทึก whitelist กลาง |
| GET `/api/office-equipment/:id/loans` | ตรวจยืมค้างจาก returned_at ตาม flow เดิม |
| POST / DELETE `/api/office-equipment/:id/photos` | multipart photos / JSON photo_path |
| POST `/api/office-equipment/:id/storage-photo` | multipart storage_photo |
| DELETE `/api/office-equipment/:id` | ลบอุปกรณ์ตามสิทธิ์เดิม |

QR และประวัติผู้ถือครองให้ใช้ component/API เดิมของ QrCodeModal และ OwnerHistoryModal โดยไม่เปลี่ยน contract ในรอบนี้

## 9. API ใหม่: ข้อเสนอที่ต้องแจ้งก่อนทำ

### รอบแรก: ใช้ API เดิมได้ แต่ต้องยืนยัน

1. endpoint site คืน network_ip แม้สำนักงานไม่มีอุปกรณ์หรือไม่ และแต่ละ field เป็น host IP, network address, CIDR หรือข้อความช่วง
2. loans/status guard บังคับใน PUT จริงหรือไม่ และตอบ error code ใดเมื่อมีการยืมค้าง ถ้ายังไม่บังคับ ต้องขอ backend เพิ่ม validation ใน endpoint เดิมก่อนเปิดการแก้สถานะร่วม
3. POST คืน ID เสมอ, PUT ละ field ได้หรือไม่/ค่าว่างหมายถึงล้าง, status enum/free text, รูปแบบวันที่ และจำนวน/ขนาดรูปจริง
4. siteId ที่ไม่พบ/ไม่มีสิทธิ์แยกจากสำนักงานมีรายการว่างอย่างไร

### ทางเลือก A — API ข้อมูลเครือข่ายแยกจากรายการอุปกรณ์

เสนอ `GET /api/pea-sites/:siteId/network-context` เฉพาะเมื่อไม่ควรโหลดรายการทั้งสำนักงานเพียงเพื่ออ่าน network_ip หรือ endpoint เดิมไม่คืนข้อมูลให้สำนักงานว่าง

ข้อมูลที่ต้องการ: site_id, pea_name, province, subnets (id/label/address/cidr โดย cidr nullable ถ้าไม่ทราบ), dhcp_ranges, source, updated_at และคำอธิบายข้อจำกัด ห้ามคืนตัวเลข prefix หรือช่วงว่างที่อนุมานเอง

scope/auth ต้องเทียบเท่า API เดิม ไม่เปิดข้อมูลเพิ่มโดยอัตโนมัติ; invalid ID400, ไม่พบ404, ไม่มีสิทธิ์403, ข้อมูลยังไม่ตั้งค่า200พร้อม arrayว่าง/unknown ไม่ใช่ข้อมูลตัวอย่าง

### ทางเลือก B — จัดการนโยบายช่วง IP จาก backend

เสนอ `GET /api/equipment/ip-allocation-policy` เมื่อเจ้าของระบบต้องการแก้แผนโดยไม่ deploy frontend ข้อมูล: policy_version, updated_at, groups พร้อม stable group_id, aliases, subnet_kind, start/end และ assumptions ข้อมูลนี้เป็น policy ไม่ใช่ inventory IP

ต้องให้เจ้าของแผนยืนยันช่วงที่ทับกันและ usableIPs ก่อนนำเข้า ไม่เพิ่ม API นี้เพียงเพื่อย้าย constant โดยไม่มีผู้ดูแลข้อมูล

**ยังไม่เสนอ IP reservation/auto-assign หรือ API “IP ว่าง” ในรอบนี้** เพราะต้องมี authoritative allocation และ atomic conflict handling ไม่สามารถใช้รายการอุปกรณ์ใน browser รับรองว่า IP ว่างได้

การป้องกันแก้ทับกันด้วย version/updatedAt และการป้องกัน POST ซ้ำด้วย idempotency เป็นความสามารถเสริมของ write API ที่ควรหารือแยก หากไม่มีให้ระบุข้อจำกัด ไม่ส่ง parameter ใหม่แล้วคาดว่า backend ใช้งานแล้ว

## 10. ลำดับดำเนินงาน

1. ทำ field/payload/permission matrix และยืนยัน4ประเด็น API เดิมในส่วน9 พร้อมทดสอบ network context ของสำนักงานที่มี/ไม่มีอุปกรณ์
2. สกัด validation, options, defaults, payload และ media lifecycle จาก EquipmentEdit ให้ behavior เดิมผ่านก่อน โดยยังไม่เปลี่ยน flow ผู้ใช้
3. สร้าง EquipmentForm ร่วม แล้วเปลี่ยน OfficeEquipmentManagement มาใช้ เพิ่ม loan guard/media และคง locked office
4. ย้าย SiteNetworkSection/IP reference มารวม ให้ฟอร์มปกติอ่านตามสำนักงานได้ ใช้ endpoint เดิมก่อน หรือรออนุมัติทางเลือก A หากจำเป็น
5. ปรับรายการ/header/toolbar/table/cards/modal ให้ตรง ListPage และเพิ่ม return context/dirty guard
6. ลบโค้ดฟอร์มซ้ำเมื่อเทียบ behavior ครบ อัปเดต USER_GUIDE.md และ GUIDE_SECTIONS ใน About.jsx; เพิ่มมาตรฐาน “ฟอร์มข้อมูลเดียวกันใช้ validation/payload กลาง” ใน DESIGN_STANDARDS.md

## 11. เกณฑ์ตรวจรับ

- [ ] เพิ่ม/แก้จากสำนักงาน, เพิ่มจากคลัง, แก้จากรายละเอียดใช้ schema/validation/payload ชุดเดียวกัน และไม่ส่ง read-only fields
- [ ] field เดิมทุกตัว สถานะเดิม/ค่าเก่านอก options และ role restrictions ไม่หาย; locked site ไม่ถูกเปลี่ยนด้วย draft ปลอม
- [ ] เพิ่มแล้วได้ ID → อัปโหลด → บันทึก/กลับรายการ ไม่สร้างซ้ำ; รูปสำเร็จ/ล้มเหลวแยกจากข้อมูลข้อความและไม่ล้าง draft
- [ ] ยืมค้าง/checking/error/เกิด loan หลังโหลด ไม่ปลดล็อก status โดยผิดพลาด; backend conflict แสดงข้อความและเก็บ draft
- [ ] network context ไม่มีข้อมูล/โหลดไม่ได้/สำนักงานว่าง/เปลี่ยนสำนักงานเร็วไม่ใช้วงเก่า; คำแนะนำไม่เขียน IP อัตโนมัติและไม่อ้าง IP ว่าง
- [ ] refresh media ไม่ทับ field ที่กำลังแก้; รูปสถานที่เปลี่ยนแล้วไม่ค้างภาพเก่าจาก cache
- [ ] กดซ้ำ/timeout/401/403/404/validation error/POST ไม่มี ID ไม่ทำข้อมูลหายหรือแสดง success เกินจริง
- [ ] search/type/page/pageSize/scroll คืนเมื่อ Back; save สำเร็จแต่ refresh ล้มเหลวไม่ชวน POST ซ้ำ
- [ ] Excel ยังเป็นทุกอุปกรณ์ในสำนักงานพร้อม label ชัดเจน คง QR/ประวัติผู้ถือครอง/รายละเอียด/ลบตามสิทธิ์
- [ ] จอ360/390/768/1280/1440px, sidebar เปิด/ปิด, light/dark, zoom200%, keyboard และข้อความไทยยาวใช้งานได้; input/select/combobox สูงเท่ากัน
- [ ] ชื่อในตารางบรรทัดเดียว ellipsis และอ่านเต็มได้ด้วย hover/รายละเอียด; mobile ไม่พึ่ง hover และไม่เกิด page overflow
- [ ] dirty guard/restore draft/ยกเลิก/Back ทำงานและสื่อว่ารูปที่บันทึกทันทีไม่ถูกย้อนคืน
- [ ] unit tests ที่มีความหมายครอบคลุม payload parity, status/loan policy, media merge, IP reference และ request race; lint/build ผ่าน พร้อมระบุข้อจำกัดการทดสอบ

งานนี้ยังเป็นเอกสารแผน การเพิ่ม API ตามทางเลือก A/B หรือเปลี่ยน business rules ต้องแจ้งและตกลงก่อนดำเนินการ
