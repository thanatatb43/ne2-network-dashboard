# แผนปรับปรุง Budget Dashboard

วันที่จัดทำ: 23 กันยายน 2026  
สถานะ: พัฒนา frontend รุ่น API ใหม่แล้ว (23 กันยายน 2026)

ผลส่งมอบ: responsive desktop/mobile, คลิกแท่งบัญชี/ผู้ใช้และจุดเดือนเปิดรายละเอียด, URL filters และ Back/Forward/refresh, รายการแบ่งหน้าจาก backend, ค้นหาข้ามคอลัมน์ทุกหน้า, รายละเอียดข้อความเต็ม และ error/retry

ข้อปรับจากแผนเดิม: ปีข้อมูลเป็น ม.ค.–ธ.ค.; account_code กับ cost_center เป็นฟิลด์เดียว; spent เป็นสุทธิ; ยังไม่รองรับ linked jobs; API ยังไม่ใช้ q จึงโหลดรายการครบทุกหน้าภายใต้ filter เฉพาะเมื่อใช้ค้นหาในผลลัพธ์ (อาจช้าสำหรับข้อมูลจำนวนมาก)

ผลตรวจจริง: summary ไม่ล้นจอ 360/390/768/1280/1440px, search ไม่ล้น 360/768/1280px, dark mobile, คลิกกราฟบัญชี/ผู้ใช้/จุดเดือน, refresh รายละเอียด, Back, คำค้นไม่พบทุกหน้า, API 503 และ retry ผ่าน; lint และ production build ผ่าน ยังไม่ได้ตรวจ screen reader และ zoom 200% แบบ manual

อ้างอิง: `src/components/BudgetDashboard.jsx`, `src/App.jsx`, `DESIGN_STANDARDS.md` และพฤติกรรมจากโค้ดปัจจุบัน

รายละเอียด endpoint, request/response schema และ migration สำหรับทีม Backend อยู่ใน [BUDGET_DASHBOARD_BACKEND_API_SPEC.md](BUDGET_DASHBOARD_BACKEND_API_SPEC.md)

## เป้าหมาย

ทำให้หน้า `/budget-dashboard` อ่านภาพรวมงบได้เร็ว ค้นหาและตรวจสอบที่มาของตัวเลขได้ง่ายขึ้น และใช้งานได้บน desktop/mobile โดย **คง feature เดิมทุกส่วน** ได้แก่

- เลือกปีงบประมาณ
- การ์ดสรุปที่คลิกเพื่อเปิดรายการเบิกจ่ายของปี
- คลิกแท่ง `งบประมาณที่ได้รับ` หรือ `ใช้ไปแล้ว` เพื่อเปิดรายละเอียดที่กรองตามรหัสบัญชี
- คลิกแท่ง Top ผู้ใช้เบิกจ่ายเพื่อเปิดรายละเอียดที่กรองตามรหัสบัญชีและผู้ใช้
- tooltip ของกราฟ, ตารางสรุปบัญชี, ค้นหาหลายเงื่อนไข, ค้นหาในผลลัพธ์, เรียงตาราง, เลือกจำนวนแถว และแบ่งหน้า
- กราฟรายเดือนและยอดรวมของผลค้นหา

การปรับต้องเพิ่มความชัดเจนของ drill-down ไม่เปลี่ยน click เป็นเพียง tooltip และไม่บังคับให้ผู้ใช้กลับไปกรอกเงื่อนไขเดิมเอง

## สิ่งที่พบจากโค้ดปัจจุบัน

| ระดับ | สิ่งที่พบ | ผลกระทบและแนวทาง |
|---|---|---|
| P1 | การคลิกกราฟเปิด route `/budget-dashboard/search` ได้ แต่เงื่อนไข/ผลอยู่เฉพาะ state ใน component | Refresh, deep link หรือ Back/Forward อาจสูญเสียบริบท ต้องเก็บ query และบริบท drill-down อย่างปลอดภัยใน URL + sessionStorage fallback |
| P1 | แท่งกราฟคลิกได้ด้วยเมาส์ แต่ SVG chart ไม่มีทางเลือกที่ชัดเจนสำหรับ keyboard/touch reader | คงการคลิกแท่งไว้ และเพิ่มปุ่ม/ตารางสรุปต่อบัญชีที่เปิดผลเดียวกัน พร้อมคำบอก “คลิกแท่งหรือเลือกดูรายละเอียด” |
| P1 | โหลด summary ไม่ตรวจ `response.ok`, ไม่มี AbortController/timeout/request identity และ error จบด้วย toast | ข้อมูลล้มเหลวอาจเห็นการ์ด ฿0 เหมือนข้อมูลจริง ต้องมี loading/error/empty/stale แยกกันและป้องกัน response เก่าทับปีใหม่ |
| P1 | หน้า search เริ่มจาก state ว่างแม้เข้าลิงก์ `/budget-dashboard/search` โดยตรง | กำหนด empty state ที่พากลับไปตั้งเงื่อนไข และ restore query ที่ถูกต้องเมื่อมี URL/session context |
| P2 | Layout หลัก, panel, filter และปุ่มมี radius 24–40px/2.5rem รวมถึง `.glass` เดิม | ไม่ตรงมาตรฐานล่าสุด: panel 16px, controls 8px, alert 12px; แยก CSS ที่ scope หน้า budget |
| P2 | Header เป็น flex แถวเดียว, padding 32px, controls กว้างคงที่ | จอ 360/768 อาจบีบหัวข้อ ปี และปุ่มค้นหา ต้อง wrap เป็นลำดับหัวเรื่อง → ปี → action |
| P2 | ชื่อรหัสบัญชีบน X-axis ยาว, กราฟ Top users หลายใบต่อกัน และ legend/tooltip ใช้ภาษาไทยอังกฤษปนกัน | อ่านยากและเทียบข้อมูลยาก ต้องมี label ย่อ, tooltip เต็ม, ลำดับที่ชัด และข้อความไทยเดียวกัน |
| P2 | ตารางรายละเอียดเก็บข้อความยาวหลายบรรทัดและหัวตารางคลิกด้วย `<th onClick>` | ยากต่อการสแกน/ไม่ใช่ control ที่ถูก semantic; ใช้ปุ่ม sort, one-line ellipsis พร้อม title และแผงรายละเอียด/expand สำหรับข้อความเต็ม |
| P2 | datalist บางช่องแสดงหลังหยุดพิมพ์ 5 วินาที | ความรู้สึกเหมือนระบบไม่ตอบสนอง เปลี่ยนเป็น searchable combobox ที่แสดงทันทีและกรองฝั่ง client โดยยังคงค่า/selector เดิม |
| P2 | ปีใน summary ถูก hard-code 2023–2026 | ปีใหม่ต้องแก้ frontend; ใช้ selector/API และ fallback ปีปัจจุบันกับปีที่มีข้อมูล |
| P2 | ความหมายของ `เบิกจ่าย`, `ไม่เบิกจ่าย` และค่าลบยังไม่อธิบาย | ต้องยืนยันความหมายกับ data owner แล้วแสดง label, สี และเครื่องหมายให้ตรงตามบัญชีจริง ไม่สรุปว่าค่าลบคือเงินคงเหลือเอง |
| P3 | สี category วนซ้ำเมื่อมีบัญชีเกินชุดสี และ summary title/empty/error มีภาษาอังกฤษ | กำหนดสีเสถียรตาม account code, contrast ผ่านทั้งสอง theme และใช้ภาษาไทยสม่ำเสมอ |

## หลักการรักษา drill-down

ทุกจุดที่นำผู้ใช้จากภาพรวมไปผลรายละเอียดใช้ contract เดียวกัน:

```text
การ์ด / แท่งกราฟ / ปุ่มดูรายละเอียด
        ↓
สร้าง BudgetQuery ที่ตรวจค่าได้
        ↓
/budget-dashboard/search?year=…&cost_center=…&username=…
        ↓
แสดง filter chips + ผลรวม + กราฟเดือน + ตารางธุรกรรม
```

- `BudgetQuery` อย่างน้อยมี `year`, `cost_center`, `clearing_account_name`, `username`, `reference_doc_no`, `description`; ไม่ใส่ token หรือข้อมูลส่วนบุคคลที่ไม่จำเป็นใน URL
- สร้าง helper เดียวสำหรับ serialize/parse/validate query; URL เป็นแหล่งจริงสำหรับ filter, `sessionStorage` เก็บเฉพาะ table search, sort, page size, scroll position และผลลัพธ์ชั่วคราวตาม key ของ query
- ผู้ใช้เปิดลิงก์ในแท็บใหม่, refresh หรือกด Back/Forward ต้องเห็น filter เดิมและโหลดผลเดิมใหม่จาก API
- เมื่อคลิกกราฟจาก summary ให้ระบุ source ใน state แบบไม่ต้องแสดงใน URL เช่น `comparison-bar`, `top-user`; หน้า results แสดง chip ที่อธิบายผล เช่น “รหัสบัญชี: 53032070” และ “ผู้ใช้: xxx” พร้อมปุ่มล้างทีละ chip
- ปุ่ม “กลับภาพรวม” คืนปีเดิม, scroll ที่เดิม และ focus ที่ control ที่เปิด drill-down; การเคลื่อน route ใช้ history ที่ไม่สร้างรายการซ้ำ
- ถ้า API search ไม่รองรับ filter เพิ่มในอนาคต ให้ทำการกรองเฉพาะผลลัพธ์ที่ API ส่งกลับและติดป้ายว่า “กรองในผลลัพธ์ที่โหลดแล้ว” ห้ามอ้างว่าค้นหาครบทั้งฐานข้อมูล

## โครงสร้างหน้าที่เสนอ

### 1. ภาพรวมงบประมาณ

```text
การใช้งานงบประมาณ
อธิบายช่วงข้อมูล / อัปเดตล่าสุด                         [ปีงบประมาณ v] [ค้นหารายการ]

[งบที่ได้รับ] [ใช้แล้ว] [คงเหลือ] [เฉลี่ยต่อเดือน]      ← มีปุ่มดูรายการที่เข้าถึงได้

งบประมาณเทียบการใช้จริง                                [คำอธิบายสี] [ดูตารางสรุป]
กราฟแท่ง (ชื่อย่อ, tooltip ชื่อเต็ม, คลิกแท่งเพื่อดูรายการ)

Top ผู้เบิกจ่ายตามรหัสบัญชี                             [บัญชี 1] [บัญชี 2] …
กราฟแนวนอนและปุ่ม “ดูรายการทั้งหมดของบัญชีนี้”

ตารางสรุปตามรหัสบัญชี                                  [ค้นหาบัญชี]
```

- Header ใช้ `list-page`/PageHeader ในอนาคต, สูงกระชับ, panel max-width 1400px; desktop วางปีและ action ขวา, mobile เรียงลงเต็มความกว้าง
- การ์ด summary เป็น `<button>` หรือมีปุ่มลูก “ดูรายการ” ชัดเจน ไม่ใช้ `motion.div onClick`; card แสดงสาเหตุ/ช่วงเวลาและ `aria-label` ที่มีจำนวนเงิน
- “คงเหลือ” แสดงทั้งจำนวนและสัดส่วน พร้อม alert style ถ้าต่ำกว่า/เกินเกณฑ์ที่ยืนยันกับเจ้าของข้อมูลแล้ว ไม่ invent threshold
- กราฟ comparison มีแกน Y เป็นเงินบาท (เช่น `฿1.2M`), axis label/account name แบบ truncate และ title/tooltip ชื่อเต็ม + code + ใช้แล้ว/ได้รับ/คงเหลือ/เปอร์เซ็นต์
- แสดง CTA ใต้กราฟด้วยรายการบัญชีแบบ compact เพื่อทำงานแทนการคลิก SVG ได้ครบ
- Top users ไม่สร้างพื้นที่ 260px สำหรับบัญชีที่ไม่มีข้อมูล; แสดง empty state เล็กใน card และรองรับจำนวนบัญชีมากด้วย section ที่พับได้หรือ “ดูบัญชีอื่น” โดยไม่ตัดข้อมูล
- ตารางสรุปเรียงตามรหัสหรือยอดใช้ตาม default ที่ประกาศชัด และแต่ละแถวเปิดรายละเอียดในผลค้นหาได้

### 2. ค้นหาและผลการเบิกจ่าย

```text
← ภาพรวมงบประมาณ                 ค้นหารายการเบิกจ่าย
Filter chips ที่ใช้งานอยู่                                      [ล้างทั้งหมด]

ปี | รหัสบัญชี | บัญชีหักล้าง | ผู้ใช้ | เลขเอกสาร | รายละเอียด
                                                      [ค้นหา] [ล้าง]

ผลลัพธ์ N รายการ  •  ช่วงข้อมูล/อัปเดตล่าสุด
[ยอดเบิกจ่าย] [ยอดปรับปรุง/ไม่เบิกจ่าย] [สุทธิ]       (ความหมายยืนยันแล้ว)

กราฟรายเดือน — คลิกแท่ง/จุดเพื่อกรองตารางตามเดือน      [ล้างตัวกรองเดือน]
ค้นหาในผลลัพธ์ | ตารางธุรกรรม | pagination
```

- แสดง filter ที่ได้มาจาก chart เป็น chips ที่ลบแยกได้; ผู้ใช้รู้ทันทีว่าทำไมผลลัพธ์จึงแคบลง
- รักษา form search เดิมทุก field แต่เปลี่ยน datalist เป็น `SearchableDropdown`/combobox ที่รองรับ keyboard, `aria-expanded`, `aria-activedescendant`, Escape และ loading/error selector
- เริ่มแนะนำเมื่อ focus หรือพิมพ์ 1 ตัวอักษร ไม่มี delay 5 วินาที; ข้อมูล selector โหลดครั้งเดียวต่อ session พร้อม retry
- กราฟเดือนคง Area/Bar/Line ตามข้อมูลเดิม แต่ให้แต่ละแท่งและจุดมี interaction: คลิก/แตะ → เพิ่ม chip เดือน; มีปุ่ม reset month และ alternative table “เดือน / เบิกจ่าย / ไม่เบิกจ่าย / รวม / ดูรายการ”
- หาก `posting_date`/เดือนในผลลัพธ์ไม่ครบ ต้องปิด interaction เดือนพร้อมข้อความที่อธิบายเหตุผล แต่อย่าทำให้กราฟหรือรายการอื่นหาย
- ผลรวมคำนวณจาก “ผลหลังกรอง” และระบุจำนวนรายการ/ช่วงข้อมูล; format เงินเป็น `th-TH`, ใช้ `font-variant-numeric: tabular-nums`
- ตาราง desktop มี col ที่จำเป็นก่อน: วันที่, เอกสาร, รายละเอียด, รหัส/ชื่อบัญชี, ผู้ใช้, จำนวนเงิน; mobile แสดง row card ที่ยังมีวันที่ เอกสาร คำอธิบายย่อ และยอด ก่อนเปิด detail drawer/modal สำหรับ field ที่เหลือ
- ถ้าคง horizontal table บน mobile ต้องทำให้ scroll เฉพาะ wrapper, มี caption/คำบอกเลื่อน และไม่มี page overflow; ชื่อ/รายละเอียดตัดหนึ่งบรรทัดพร้อม `title` และรายละเอียดเต็มใน row detail
- หัว sort ใช้ `<button>` พร้อม `aria-sort`, icon, focus; reset page เมื่อ filter/sort/page size เปลี่ยน และ clamp page เมื่อผลลดลง

## Data, state และ error handling

- แยก state ของ summary, selector และ search เป็น `{status, data, error, requestKey, updatedAt}`; status อย่างน้อย `loading`, `success`, `empty`, `error`, `stale`
- ทุก request ใช้ `AbortController`, timeout ที่กำหนดเดียว, ตรวจ `response.ok` ก่อน parse และ response guard ตาม selectedYear/query ปัจจุบัน
- เมื่อเปลี่ยนปี ให้เก็บข้อมูลปีเก่าไว้เป็น stale ได้จนข้อมูลใหม่สำเร็จ พร้อมป้าย “กำลังอัปเดตเป็นปี …”; ห้ามแทน error ด้วยยอด ฿0
- กรณีไม่พบข้อมูลจริง: แสดง “ยังไม่มีข้อมูลสำหรับปี …” พร้อมเปลี่ยนปี/ล้าง filter; กรณีผิดพลาด: state บนหน้า + ปุ่มลองใหม่ ไม่พึ่ง toast อย่างเดียว
- ตรวจ type ทุกฟิลด์ตัวเลขและวันก่อน `toLocaleString`, chart, sort หรือคำนวณเปอร์เซ็นต์; ใช้ `null`/“—” แทนเลข 0 ที่ไม่มีข้อมูล
- ย้าย `manualMap` ของ account name เป็น data/config ที่มีเจ้าของชัดเจน หรือให้ API ส่ง display name; อย่ากระจายใน fetch summary/search/filter
- ตรวจ contract API ก่อนเพิ่ม deep link เดือน/ชนิดธุรกรรม: `/api/budgets/summary/:year`, `/api/budgets/transactions/selectors`, `/api/budgets/transactions/find` และ shape `summary.by_month`, `grand_total`
- ห้าม log error ที่มี request params หรือ transaction data เกินจำเป็นใน production console

## Visual system และ responsive

- สร้าง `BudgetDashboard.css` ที่ scope ด้วย `.budget-dashboard` แทน inline styles สำหรับ layout; ใช้ `ListPage.css` เมื่อ pattern ตรงกัน
- ใช้ panel radius 16px, control/button 8px, padding panel 20px desktop/16px mobile, gap 16/24px ตาม `DESIGN_STANDARDS.md`; ยกเลิก panel หลัก 2.5rem และ button/filter 1.5–2rem
- ไม่ใช้ `gradient-text` หรือ rainbow gradient เป็นตัวแทนข้อมูลสำคัญ; สีข้อมูลคงความหมายและใช้ legend/label ประกอบ ไม่อาศัยสีอย่างเดียว
- Desktop 1280–1440px: summary 4 columns, comparison เต็มแถว, Top users grid 2–3 columns ตามพื้นที่, results header search/summaries อยู่บรรทัดเดียวเมื่อพอ
- Tablet 768px: summary 2 columns, header/action wrap, chart labels ลดความหนาแน่น, Top users 2 columns
- Mobile 360/390px: page padding 16px, summary 1 column, ปีและ action full width, chart 240–280px, top user 1 column, filters เรียงตาม workflow, pagination wrap; ไม่มี horizontal page scroll
- ตรวจ light/dark โดยเฉพาะ table header ที่ปัจจุบันใช้ `#f8fafc`, ปุ่ม reset gradient สีตายตัว และ border `rgba(0,0,0,...)`
- ลด motion เมื่อ `prefers-reduced-motion`; animation ไม่ขัดการอ่าน/การคลิก chart

## Accessibility

- ทำ interactive card, row และ chart alternative เป็น button/anchor; มี label ที่สื่อถึง filter ที่จะใช้ เช่น “ดูรายการรหัสบัญชี 53032070 ปี 2569”
- Tooltip เป็นข้อมูลเสริม ไม่ใช่วิธีเดียวในการรู้ค่า/เปิดรายละเอียด; value และ action ต้องปรากฏในตาราง/ปุ่ม alternative
- Chart SVG มี `role="img"`/ชื่อ/คำอธิบาย; keyboard user ใช้ alternative table ได้เทียบเท่า
- ทุก input มี `<label htmlFor>`, error text ผูก `aria-describedby`, search state ใช้ `aria-live="polite"`; ไม่ auto-focus จนขโมย focus ระหว่างโหลด
- ใช้ focus-visible 3px/offset 3px, target 44px สำหรับปุ่มหลักและ pagination; ตรวจ contrast ของ warning/danger บนทั้ง theme
- ถ้าใช้ modal/drawer ดูรายละเอียดธุรกรรม ให้ใช้ dialog semantic, initial focus, focus trap, Escape, return focus และไม่ปิดเมื่อกด backdrop หากอาจทำให้ฟอร์ม/ตัวกรองหายโดยไม่เตือน

## ลำดับพัฒนา

1. **เก็บ contract และ baseline** — บันทึก input/output API, รายการ feature click เดิม, ความหมายค่าบวก/ลบ, screenshot 360/768/1280 light/dark และ test navigation ปัจจุบัน
2. **State และ URL drill-down** — สร้าง BudgetQuery, parse/serialize/validation, restore query/session/scroll/focus และ request layer ที่ abort/error-safe โดยยังคง UI เดิมก่อน
3. **โครงหน้าและ tokens** — แยก CSS, ปรับ PageHeader/summary/filter/panel/table ให้ตรงมาตรฐาน และ responsive layout โดยไม่แตะ handler chart
4. **ทำ interaction ชัดและเข้าถึงได้** — ต่อ chart/card/summary row ไป helper เดียว, เพิ่ม filter chips, chart alternatives และ monthly drill-down ที่ตรวจ API แล้ว
5. **ค้นหา/ตาราง** — ปรับ selector, sort semantics, mobile detail, empty/error/stale state และ pagination context
6. **ตรวจรับ/เอกสาร** — อัปเดต `USER_GUIDE.md`, `About.jsx` และ `DESIGN_STANDARDS.md` เฉพาะมาตรฐานใหม่ที่ใช้ซ้ำได้

## เกณฑ์ตรวจรับ

- [ ] คลิกการ์ด, แท่ง comparison และแท่ง Top user ยังคงเปิดผลรายการที่กรองถูกบัญชี/ผู้ใช้/ปี
- [ ] กด Back/Forward, refresh, เปิดผล drill-down ในแท็บใหม่ และ deep link `/budget-dashboard/search?...` ยังคืน filter และผลถูกต้อง
- [ ] กราฟรายเดือนคลิกเพื่อกรองรายละเอียดได้ หรือแสดงทางเลือกเทียบเท่าตาม contract API ที่ตรวจแล้ว
- [ ] ล้าง chip หนึ่งตัว, ล้างทั้งหมด, เปลี่ยนปี, ส่ง form, sort, page size และ table search ไม่ทิ้ง state ที่ขัดกันหรืออยู่หน้าว่าง
- [ ] Summary/search selector API สำเร็จ, 4xx/5xx, timeout, abort, malformed data, ไม่มีข้อมูล, เปลี่ยนปีเร็ว และ response สลับลำดับ แสดงสถานะถูกต้อง ไม่มี ฿0 ปลอม
- [ ] จำนวนเงิน, สัดส่วน, วันที่, สี และข้อความ “เบิกจ่าย/ไม่เบิกจ่าย” ผ่านการยืนยันจากเจ้าของข้อมูล
- [ ] Keyboard ทำงานกับทุก control หลัก และมี alternative ที่เทียบเท่าสำหรับ click graph; tooltip ไม่ใช่ข้อมูลหรือ action ทางเดียว
- [ ] ตรวจ 360, 390, 768, 1280, 1440px, จอสั้น, zoom 200%, light/dark และข้อความไทยยาว: ไม่มี page overflow
- [ ] ตารางยังมีทุก field เดิมและเปิดดูข้อความเต็มได้; mobile ไม่สูญเสียข้อมูลที่อยู่ในคอลัมน์ซ่อน
- [ ] lint ไฟล์ที่แก้, production build และ test interaction ด้วย mock API ผ่าน โดยไม่สร้าง/แก้ transaction จริง

## สิ่งที่ต้องยืนยันก่อนลงมือ

1. ค่าติดลบใน transaction และคำว่า “ไม่เบิกจ่าย” หมายถึงอะไรในบัญชีจริง และควรแสดงเป็นยอดปรับปรุง/คืนเงิน/หมวดอื่นหรือไม่
2. API `/api/budgets/transactions/find` รองรับ filter เดือน, วันที่ หรือชนิดธุรกรรมหรือไม่; หากไม่รองรับ การกรองเดือนจะจำกัดเฉพาะชุดผลลัพธ์ที่ดาวน์โหลดแล้ว
3. ผู้ใช้ budget dashboard เป็น public/read-only ตามปัจจุบันหรือมีข้อมูลที่ควรซ่อนตาม role/site ก่อนใส่ deep links และ caching
