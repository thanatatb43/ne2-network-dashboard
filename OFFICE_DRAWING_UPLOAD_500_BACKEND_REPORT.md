# ตรวจสอบอัปโหลดรูปในแบบสำนักงาน: HTTP 500

ผู้ใช้พบ `POST http://172.21.5.49:3000/api/office-drawings/assets` ตอบ HTTP 500 ระหว่างวางรูปจาก clipboard จึงยังไม่ได้ asset ID สำหรับเพิ่มรูปลงแบบ

## Request ฝั่ง frontend

- `multipart/form-data` มีไฟล์หนึ่งไฟล์ใน field `file` ตาม contract
- ส่ง `Authorization: Bearer <session token>`
- ให้ browser กำหนด Content-Type และ multipart boundary เอง
- ใช้ API เดียวกันทั้งเลือกไฟล์ ลากไฟล์ และ Ctrl+V
- เพิ่มนามสกุลตาม MIME สำหรับ clipboard Blob ที่ไม่มีชื่อแล้ว
- ไม่ retry POST อัตโนมัติ เพื่อป้องกันสร้าง asset ซ้ำ

## ขอ backend ตรวจสอบ

1. ตรวจ exception log ของ endpoint ณ เวลาที่เกิดปัญหา และ response body จริง ขณะนี้มีเพียง HTTP 500 จึงยังระบุสาเหตุภายในไม่ได้
2. ตรวจ deployment/migration ของตารางเก็บ binary รูป และ dependency สำหรับ decode รูปบนเครื่องที่ใช้งานจริง
3. ทดสอบ PNG ขนาดเล็กผ่าน multipart field `file` ด้วยบัญชีที่มีสิทธิ์ รวมถึงรูปจาก clipboard
4. กรณีไฟล์ไม่รองรับหรืออ่านไม่ได้ ให้คืน validation error ตาม contract แทน HTTP 500 ส่วน error ภายในให้มีรหัสอ้างอิงสำหรับตาม log โดยไม่ส่ง stack trace ให้ผู้ใช้
5. ยืนยัน upload สำเร็จคืน `data.id`, `width_px`, `height_px` และสามารถอ่าน content ของ asset ด้วย token เดิมก่อนบันทึกแบบได้

## ขอบเขต clipboard

Frontend เพิ่ม Ctrl+C / Ctrl+V สำหรับวัตถุที่เลือกภายในแบบเดียวกันแล้ว ไม่ต้องเพิ่ม API สำหรับกรณีนี้ ส่วนวัตถุจาก Visio/Office ต้องมีรูป PNG/JPEG/WebP อยู่ใน clipboard จึงอัปโหลดเป็นรูปได้ ยังไม่ได้รองรับการนำเข้าวัตถุ native ของโปรแกรมเหล่านั้น

## เกณฑ์ตรวจรับร่วมกัน

- เลือกไฟล์และวางรูปจาก clipboard สำเร็จ ได้ asset ID แล้วเห็นรูปในแบบ
- บันทึกและเปิดแบบใหม่ รูปยังแสดงครบ
- เมื่อ backend ล้มเหลว หน้าเว็บแจ้ง HTTP status และไม่เพิ่มวัตถุรูปที่ไม่มี asset ID

ยังไม่ได้ยืนยันการแก้ HTTP 500 เพราะไม่มี backend source/log ใน workspace นี้
