# แผนปรับปรุง Sidebar และเปลี่ยนชื่อระบบเป็น NE2 LDAP

วันที่จัดทำ: 23 กันยายน 2026

สถานะ: แผนสำหรับพัฒนา ยังไม่ได้แก้หน้าระบบ

ชื่อมาตรฐานที่ยืนยันแล้ว:

- ชื่อย่อ: **NE2 LDAP**
- ชื่อเต็มภาษาอังกฤษ: **LAN & Device Asset Platform**
- ชื่อเต็มภาษาไทย: **ระบบบริหารอุปกรณ์คอมพิวเตอร์และเครือข่าย กฟฉ.2**

อ้างอิง: [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md), `src/components/Sidebar.jsx`, `src/App.jsx`, `src/index.css` และ `index.html` จากโค้ดปัจจุบัน การตรวจครั้งนี้เป็นการอ่านโค้ด ไม่ใช่ผลทดสอบหน้าตาในเบราว์เซอร์

## 1. เป้าหมายและขอบเขต

- ใช้ชื่อ **NE2 LDAP** อย่างสม่ำเสมอใน sidebar, หน้าเกี่ยวกับระบบ, หน้าลงชื่อเข้าใช้ และชื่อแท็บ browser
- ทำให้ผู้ใช้หาเมนู เข้าใจตำแหน่งปัจจุบัน และเปิด/ปิดเมนูได้สะดวกด้วยเมาส์ สัมผัส และคีย์บอร์ด
- รองรับ desktop แบบ sidebar ข้างเนื้อหา และ mobile/tablet แบบ drawer ตาม breakpoint เดิม 1024px
- รักษา URL, สิทธิ์เข้าถึง, การกลับหลัง และข้อมูลค้นหา/ตัวกรองของแต่ละหน้า
- การเปลี่ยนชื่อเป็นการเปลี่ยนชื่อผลิตภัณฑ์ ไม่เปลี่ยนระบบ authentication หรือเพิ่มการเชื่อมต่อ LDAP จากชื่อเพียงอย่างเดียว

## 2. สิ่งที่พบและลำดับความสำคัญ

| ระดับ | สิ่งที่พบจากโค้ด | ผลกระทบ / แนวทาง |
|---|---|---|
| P1 | เมนู กลุ่มเมนู และลิงก์ Down ใช้ `div onClick` | ใช้ anchor สำหรับนำทาง และ button สำหรับเปิด/ปิดกลุ่ม ให้ Tab/Enter/Space ทำงานตาม semantic |
| P1 | Mobile drawer ยังไม่มี focus trap, Escape, คืน focus และ background inert | ผู้ใช้คีย์บอร์ดอาจหลุดไปกดหน้าด้านหลัง เพิ่มพฤติกรรม modal เฉพาะโหมด drawer |
| P1 | Active menu เทียบ `activeTab` ตรง ๆ | หน้ารายละเอียด/แก้ไข เช่น jobDetails และ equipmentDetails ไม่มีเมนูหลัก active ต้องมี route-to-menu mapping |
| P1 | เมื่อ status-summary ล้มเหลวครั้งแรก ค่า offline ยังเป็น 0 และ loading กลายเป็น false | อาจแสดงเขียวทั้งที่ไม่ทราบสถานะ แยก loading/error/stale/success/empty และห้ามแทนค่าที่ขาดด้วย 0 |
| P1 | ชื่อ sidebar/About เป็นชื่อเดิม แต่ HTML title เป็น `NE2 \| LAN Monitoring` | เปลี่ยนจุดแสดงชื่อให้ครบ และเพิ่มแหล่งชื่อกลาง |
| P2 | Style จำนวนมากเป็น inline และ sidebar mobile ใช้ `100vh`, fixed width 300px | แยก CSS ที่ scope, ใช้พื้นที่ viewport แบบ dynamic และทดสอบจอสั้น/ซูม |
| P2 | บัญชีผู้ใช้กับ status card อยู่นอก nav ที่เลื่อนได้ | จอสั้นอาจเหลือพื้นที่เมนูน้อย ต้องมี fallback ให้พื้นที่ drawer เลื่อนได้ครบ |
| P2 | Total ใช้สีดำตายตัว และข้อความไทย/อังกฤษปะปน | ใช้ semantic tokens และคำไทยให้สม่ำเสมอ |
| P2 | สถานะเปิดกลุ่มอยู่เฉพาะ component และ override อาจซ่อนเมนูที่กำลังใช้งาน | เก็บ preference อย่างมีขอบเขต พร้อมเปิดกลุ่มของหน้าปัจจุบันเมื่อ route เปลี่ยน |

## 3. โครงสร้างเมนูที่เสนอ

คงกลุ่มเดิมเพื่อให้ผู้ใช้คุ้นเคย ปรับชื่อที่กำกวมและจัดลำดับภายในกลุ่มตามงาน:

```text
โลโก้ PEA   NE2 LDAP                         [ยุบ/ปิด]
           ระบบบริหารอุปกรณ์คอมพิวเตอร์และเครือข่าย กฟฉ.2

แผนที่
งบประมาณ
ระบบเครือข่าย
  ภาพรวมเครือข่าย
  อุปกรณ์เครือข่าย         (ชื่อเดิม: อุปกรณ์ทั้งหมด)
  ประวัติการขัดข้อง
  ตรวจสอบการเชื่อมต่อ      (แสดงเมื่อเข้าสู่ระบบ ตามเดิม)
ระบบคอมพิวเตอร์
  ค้นหาอุปกรณ์
  ยืมอุปกรณ์
  ประวัติการยืม
แจ้งปัญหา
การจัดการ                  (ตามสิทธิ์เดิม)
  จัดการงานและอุปกรณ์
  การตั้งค่าระบบ            (super_admin / manager)
เกี่ยวกับระบบและคู่มือ      (ชื่อเดิม: About)

สถานะเครือข่ายแบบย่อ → ภาพรวม / อุปกรณ์ขัดข้อง
บัญชีผู้ใช้ + ลงชื่อออก หรือ ลงชื่อเข้าใช้งาน
```

- ชื่อรองเป็นข้อความเสนอ สามารถปรับถ้อยคำได้โดยไม่เปลี่ยนชื่อหลัก NE2 LDAP
- ย้ายทางลงชื่อเข้าใช้ไปพื้นที่บัญชีเพียงตำแหน่งเดียว ไม่แสดงซ้ำในเมนูหลัก
- คงโลโก้ PEA และฟอนต์ Krub เดิม ใช้คำขยาย LDAP ที่ยืนยันแล้ว: LAN & Device Asset Platform
- แสดงชื่อเมนูเต็มเป็นหลัก อนุญาตให้ wrap เมื่อจำเป็น ไม่ทำ sidebar แบบเหลือไอคอนอย่างเดียวในรอบนี้
- กลุ่มเปิดได้หลายกลุ่ม ไม่บังคับ accordion ทีละกลุ่ม

## 4. Layout และมาตรฐานภาพ

### Desktop: กว้างมากกว่า 1024px

- Sidebar กว้างเริ่มต้น 280px และ `flex-shrink: 0`; ตรวจชื่อไทยยาวก่อนยืนยันความกว้าง
- แบ่งเป็น brand, navigation, status/account ด้วย spacing หรือเส้นขอบบาง ไม่ใช้การ์ดซ้อนหลายชั้น
- ใช้ `height: calc(100dvh - 32px)` พร้อม fallback; nav มี `min-height: 0; overflow-y: auto`
- ถ้าจอเตี้ยจน footer เบียด nav ให้ sidebar ทั้งส่วนเนื้อหาเลื่อนได้ โดยปุ่มปิดยังเข้าถึงได้
- ยุบแล้วเนื้อหาขยายใช้พื้นที่เพิ่ม ปุ่มเปิดเมนูอยู่ในพื้นที่ header ที่สงวนไว้ ไม่ทับหัวข้อหรือ toolbar
- เก็บค่าเปิด/ปิด desktop ใน localStorage แบบมี version และ try/catch; ไม่ใช้ค่านี้บังคับเปิด drawer บนมือถือ

### Mobile/tablet: กว้างไม่เกิน 1024px

- เปิดเป็น drawer overlay กว้าง `min(300px, calc(100vw - 48px))` สูง `100dvh` และรองรับ safe-area
- ค่าเริ่มต้นปิด มี backdrop และปุ่มปิดด้านใน พื้นที่สัมผัสอย่างน้อย 44×44px
- ล็อก scroll ของหน้าด้านหลังและคืนค่าหลังปิด/เปลี่ยน breakpoint/unmount
- เลือกเมนูแล้วปิด drawer; Ctrl/Cmd-click และเปิดแท็บใหม่ยังทำงานตาม anchor
- เมื่อข้าม breakpoint ให้ปิด modal behavior และคืน background/inert/scroll lock ครบ ไม่เปิดหรือปิดซ้ำทุก resize

### Styles ร่วม

- ใช้สีจาก tokens เดิม: text-primary, text-secondary, border-subtle, accent-primary, sidebar-item-active
- แถวเมนูสูงอย่างน้อย 44px, icon 18–20px, gap 12px, radius 8px; กล่อง sidebar radius 16px บน desktop
- Active มีสีพื้น น้ำหนักตัวอักษร และเครื่องหมายข้างแถว ไม่อาศัยสีอย่างเดียว
- Hover, active และ focus-visible แยกกัน; focus 3px offset 3px ตามมาตรฐาน
- ใช้ reduced motion กับ animation drawer และกลุ่มเมนู รวมถึง Framer Motion ไม่ใช่ CSS เพียงอย่างเดียว

## 5. Navigation, active state และ persistence

- กำหนด navigation config กลาง เช่น `src/config/navigation.js`: id, label, href, icon, children, visibility และ active mapping โดยตรวจ URL จริงจาก App ก่อนลงโค้ด
- ใช้ `<nav aria-label="เมนูหลัก">` และรายการ `<ul>/<li>`; anchor มี href จริง และ intercept เฉพาะคลิกซ้ายไม่มี modifier
- กลุ่มใช้ button พร้อม `aria-expanded` และ `aria-controls`; หน้า active ใช้ `aria-current="page"` เมื่อเป็นหน้าที่ลิงก์ชี้จริง ส่วนหน้าลูกให้ระบุความสัมพันธ์ผ่าน active styling/คำบอกบริบทอย่างเหมาะสม
- เพิ่มตาราง mapping ของหน้าลูก: รายละเอียดงาน → แจ้งปัญหา, รายละเอียด/แก้ไขอุปกรณ์ → ค้นหาอุปกรณ์เป็น fallback, อุปกรณ์เครือข่ายขัดข้อง → ระบบเครือข่าย
- หากรายละเอียดอุปกรณ์เข้าจากยืมหรือประวัติ ให้เก็บต้นทางที่ตรวจสอบได้ใน navigation state เพื่อ highlight เมนูต้นทาง; เปิดลิงก์ตรงใช้ fallback ที่กำหนด
- Route เปลี่ยนต้องเปิดกลุ่มที่มีหน้าปัจจุบัน ผู้ใช้ยังยุบกลุ่มนั้นเองได้จนกว่าจะเปลี่ยน route อีกครั้ง
- เก็บกลุ่มที่เปิดใน sessionStorage แบบ versioned; storage ล้มเหลวต้องใช้งานต่อได้ และไม่เก็บข้อมูลบัญชีเพิ่ม
- การกดเมนูเดิมไม่สร้าง history ซ้ำโดยไม่จำเป็น; browser Back/Forward ต้องอัปเดต active state ผ่าน route กลาง
- ไม่ล้าง sessionStorage ของแต่ละหน้าเมื่อเปลี่ยนเมนูหรือเปลี่ยนชื่อระบบ
- หลังนำทางให้ focus หัวข้อ/main ตามรูปแบบกลาง ไม่คืน focus ไปปุ่มเปิด drawer ทับ focus ของหน้าใหม่; ปิด drawer ด้วย Escape/backdrop ให้คืน focus ปุ่มเปิด

## 6. Accessibility ของ drawer

- Desktop เป็น navigation ปกติ ไม่มี focus trap หรือ aria-modal
- Mobile ใช้ wrapper `role="dialog"`, `aria-modal="true"` และชื่อ dialog; nav อยู่ภายใน
- เปิดแล้ว focus ปุ่มปิดหรือรายการปัจจุบันที่มองเห็นได้; Tab/Shift+Tab วนภายใน
- Escape ปิดเฉพาะ overlay ที่อยู่บนสุด ระวังชนกับ modal ของหน้าปัจจุบัน
- ตั้ง background inert กับ sibling ของ drawer เท่านั้น ห้ามทำ parent ของ drawer inert
- ปุ่มเปิดมีชื่อที่อ่านได้, `aria-expanded`, `aria-controls`; ปุ่มปิดมี aria-label ชัดเจน
- หาก route เปลี่ยนจาก browser หรือผู้ใช้ logout ระหว่างเปิด drawer ให้ cleanup listener, scroll lock และ focus อย่างปลอดภัย

## 7. สถานะเครือข่ายท้าย sidebar

- เปลี่ยนชื่อ System Status เป็น “สถานะเครือข่าย” เพราะ endpoint วัดอุปกรณ์ ไม่ได้ยืนยันสุขภาพของระบบทั้งหมด
- แสดงสรุปสั้น “ออนไลน์ X / ทั้งหมด Y” และ “ขัดข้อง Z” พร้อมลิงก์ดูรายละเอียด; ไม่เพิ่มกราฟใน sidebar
- แยก `null`/ไม่มีข้อมูลออกจาก 0; เขียวได้ต่อเมื่อโหลดสำเร็จ ข้อมูลถูกต้อง มีอุปกรณ์ และ offline เป็น 0
- ครั้งแรกผิดพลาด: “โหลดสถานะไม่ได้” + ลองใหม่; ข้อมูลเก่าที่รีเฟรชผิดพลาด: คงค่า พร้อมเวลาอัปเดตและคำว่า “ข้อมูลจากครั้งก่อน”
- ตรวจ HTTP status, success และชนิดข้อมูล; เพิ่ม timeout, AbortController, cleanup และป้องกัน request ซ้อน/response เก่าทับใหม่
- คงรอบรีเฟรช 60 วินาที ตรวจการใช้ร่วมกับ useNetworkData ก่อนแชร์ cache เพราะแต่ละ endpoint อาจมีขอบเขตข้อมูลต่างกัน
- เมื่อแท็บ browser ถูกซ่อนให้พัก polling และรีเฟรชเมื่อกลับมา ถ้าครบช่วงเวลาที่กำหนด
- ข้อความสถานะต้องอ่านได้ใน light/dark และไม่ประกาศ live region ทุกนาทีจนรบกวนผู้ใช้

## 8. จุดเปลี่ยนชื่อระบบ

| ไฟล์ | งานที่ต้องทำ |
|---|---|
| `src/config/branding.js` (เสนอเพิ่ม) | กำหนด `APP_NAME = 'NE2 LDAP'`, `APP_NAME_FULL = 'LAN & Device Asset Platform'` และ `APP_NAME_TH = 'ระบบบริหารอุปกรณ์คอมพิวเตอร์และเครือข่าย กฟฉ.2'` สำหรับ React |
| `src/components/Sidebar.jsx` | แสดงชื่อจาก branding พร้อมโลโก้เดิม |
| `src/components/About.jsx` | เปลี่ยนหัวชื่อระบบและปรับ GUIDE_SECTIONS ให้ตรงกับเมนูใหม่ |
| `src/components/Auth.jsx` | เพิ่ม/ปรับชื่อผลิตภัณฑ์เป็น NE2 LDAP และคงคำอธิบายไทยที่เหมาะสม |
| `index.html` | title เป็น NE2 LDAP, lang เป็น th, description ภาษาไทยตรงกับขอบเขตระบบ |
| `src/App.jsx` | กำหนด document.title รูปแบบ “ชื่อหน้า \| NE2 LDAP”; รายละเอียดใช้ชื่อประเภทหน้าเป็น fallback |
| `README.md`, `USER_GUIDE.md` | อัปเดตชื่อผลิตภัณฑ์และโครงสร้างเมนู |
| `DESIGN_STANDARDS.md` | เพิ่มข้อกำหนด brand, navigation, active state, drawer และ persistence หลังยืนยันแบบ |

HTML title ตั้ง fallback แบบ static เพื่อให้ถูกต้องก่อน JavaScript โหลด และตรวจให้ตรงกับ branding ในรอบ review ไม่จำเป็นต้องเพิ่ม build pipeline เพื่อชื่อเดียว

ค้นชื่อเดิมและชื่ออังกฤษทั่ว source/public/docs อีกครั้งก่อนส่งงาน เปลี่ยนเฉพาะข้อความที่หมายถึงชื่อผลิตภัณฑ์ คำอธิบายหน้าภาพรวมเครือข่ายยังใช้คำว่า “ตรวจสอบเครือข่าย” ได้ ไม่เปลี่ยนชื่อ API, repository, package, URL, storage key, SSO redirect หรือข้อมูลประวัติย้อนหลังจากการ replace ทั้งหมด

## 9. แผนดำเนินงาน

1. **Branding และ navigation config:** ทำบัญชี route/สิทธิ์จาก App และ Sidebar, เพิ่มชื่อกลาง, แก้จุดแสดงชื่อและ title ให้ครบ ตรวจไม่มีผลต่อ login/redirect
2. **Sidebar semantics และ active state:** เปลี่ยน div เป็น anchor/button, เพิ่ม mapping หน้าลูก, การเปิดกลุ่ม และ history behavior
3. **Responsive และ drawer:** แยก Sidebar.css, ปรับพื้นที่ nav/footer, desktop preference, focus/inert/Escape/scroll lock และ reduced motion
4. **สถานะข้อมูล:** แก้ loading/error/stale/empty และ polling ให้ถูกต้อง พร้อมลิงก์สรุปที่ใช้งานด้วยคีย์บอร์ดได้
5. **คู่มือและตรวจรับ:** อัปเดตคู่มือสองจุดกับมาตรฐาน ออก screenshot ทั้งสอง theme และรัน checks

แต่ละช่วงต้องคงเมนูเดิมครบและตรวจ role gating ก่อนทำช่วงต่อไป ไฟล์ที่มีการแก้ค้างจากงานอื่นต้องรักษา diff เดิม

## 10. เกณฑ์ตรวจรับ

- [ ] ทุกจุดที่เป็นชื่อผลิตภัณฑ์แสดง NE2 LDAP รวม browser title ก่อน/หลังโหลดหน้าและ refresh ลิงก์ตรง
- [ ] Desktop 1280/1440px, mobile 360/390px, tablet 768px, breakpoint 1024/1025px ไม่มีหน้าเลื่อนแนวนอน
- [ ] จอสั้น 360×640 และแนวนอน, zoom 200%, ชื่อผู้ใช้/เมนูไทยยาว ยังเข้าถึงเมนู ลงชื่อออก และปุ่มปิดได้
- [ ] ทั้ง light/dark อ่านข้อความและ active/focus ได้ชัดเจน ไม่มีสีดำตายตัวใน status
- [ ] Tab/Shift+Tab/Enter/Space/Escape ทำงานตามชนิด control; focus ไม่หลุด drawer และคืนถูกจุดหลังปิด
- [ ] เปิด/ปิด drawer ระหว่าง resize และเปลี่ยน route ไม่เหลือ body scroll lock หรือ inert ค้าง
- [ ] คลิกเมนู, เปิดแท็บใหม่, deep link, refresh, Back/Forward และเข้าหน้ารายละเอียด/แก้ไข แสดง active parent ถูกต้อง
- [ ] ค้นหา/กรอง → รายละเอียด → กลับ ยังมีข้อมูลและบริบทเดิม; เปลี่ยนชื่อไม่ล้าง storage
- [ ] Guest, ผู้ใช้ทั่วไป, computer_admin, network_admin, operator, manager, super_admin เห็นเมนูตามเงื่อนไขเดิม; settings เฉพาะ manager/super_admin
- [ ] API status สำเร็จ/ศูนย์จริง/ไม่มีข้อมูล/ผิดรูปแบบ/500/timeout/ข้อมูลเก่า ไม่รายงานเขียวหรือจำนวนศูนย์ผิด ๆ
- [ ] Polling ไม่ซ้อนและ cleanup ถูกต้อง ไม่มี request เพิ่มจากการเปิดปิดกลุ่มเมนู
- [ ] lint ไฟล์ที่แก้และ production build ผ่าน พร้อมทดสอบ interaction สำคัญโดยใช้ mock API ไม่เปลี่ยนข้อมูลจริง
- [ ] GUIDE_SECTIONS, USER_GUIDE และ DESIGN_STANDARDS อธิบายพฤติกรรมเดียวกับที่ส่งมอบ

## 11. ผลส่งมอบที่คาดหวัง

Sidebar ที่ใช้เมนูเดิมได้ครบ มีตำแหน่งปัจจุบันชัดเจน รองรับ desktop/mobile และคีย์บอร์ด พร้อมชื่อ NE2 LDAP ทุกจุดที่ผู้ใช้เห็น และสถานะเครือข่ายที่ไม่ทำให้เข้าใจผิดเมื่อข้อมูลโหลดไม่สำเร็จ
