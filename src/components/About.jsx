import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Info, User, BarChart3, Globe, ShieldCheck, Cpu, Code2, Users, Eye, BarChart, History, Loader2, Calendar, Clock,
  BookOpen, Map, Network, Boxes, ChevronDown, ClipboardList
} from 'lucide-react';
import peaLogo from '../assets/logo/pea_logo.png';

// Mirrors the sidebar's menu groups (see Sidebar.jsx) so the guide stays a
// straightforward walkthrough of "what's in the menu" rather than a separate
// description of the app that could drift out of sync with it. `steps` is
// optional -- items without it just don't show an expand toggle.
const GUIDE_SECTIONS = [
  {
    title: 'เมนูหลัก',
    icon: Map,
    color: '#3b82f6',
    items: [
      {
        name: 'แผนที่',
        desc: 'ภาพรวมสำนักงานทั้งหมดในรูปแบบแผนที่ พร้อมสถานะอุปกรณ์เครือข่ายของแต่ละสำนักงาน',
        steps: [
          'เปิดเมนู "แผนที่" จากแถบเมนูด้านซ้าย',
          'ใช้ตัวกรองด้านบน (จังหวัด / ประเภทสำนักงาน / สถานะ) เพื่อจำกัดเฉพาะสำนักงานที่ต้องการดู',
          'คลิกหมุดบนแผนที่เพื่อเปิด popup แสดงข้อมูลสำนักงานและอุปกรณ์เครือข่ายของสำนักงานนั้น',
          'ในกล่อง popup คลิกชื่ออุปกรณ์เพื่อไปยังหน้ารายละเอียดอุปกรณ์ (สถานะ, ค่า latency ล่าสุด)',
          'กดปุ่มขยายเต็มจอที่มุมขวาบนของแผนที่เพื่อดูแบบเต็มหน้าจอ'
        ]
      },
      {
        name: 'ภาพรวมการใช้งบประมาณ',
        desc: 'สรุปการใช้จ่ายงบประมาณและรายการธุรกรรมทั้งหมด',
        steps: [
          'เปิดเมนู "ภาพรวมการใช้งบประมาณ"',
          'หน้าเริ่มต้น (สรุป) แสดงกราฟและตัวเลขสรุปการใช้จ่ายงบประมาณ',
          'กดปุ่ม "ค้นหาข้อมูลการเบิกจ่าย" เพื่อสลับไปหน้าค้นหารายละเอียด',
          'กรอกเงื่อนไข เช่น ปีงบประมาณ, รหัสบัญชี แล้วกดค้นหา',
          'กดปุ่มลูกศรย้อนกลับเพื่อกลับไปหน้าสรุป'
        ]
      }
    ]
  },
  {
    title: 'ระบบเครือข่าย',
    icon: Network,
    color: '#14b8a6',
    items: [
      {
        name: 'ตรวจสอบการเชื่อมต่อ',
        desc: 'ทดสอบและตรวจสอบสถานะการเชื่อมต่อเครือข่าย (ต้องเข้าสู่ระบบ)',
        steps: [
          'เข้าสู่ระบบก่อน จึงจะเห็นเมนูนี้',
          'หน้านี้แสดง IP สาธารณะ/ภายใน ชื่อเครื่อง และ MAC Address ของเครื่องที่ใช้งานอยู่ให้อัตโนมัติ',
          'ระบบตรวจสอบสถานะการเชื่อมต่อไปยัง gateway หลักและอินเทอร์เน็ตให้อัตโนมัติ (แสดงสถานะออนไลน์/ออฟไลน์)',
          'กดปุ่มทดสอบความเร็วเพื่อวัด download / upload / latency ของการเชื่อมต่อปัจจุบัน',
          'ใช้ช่องตรวจสอบ IP เพื่อตรวจสอบสถานะของ IP อื่นที่ต้องการเพิ่มเติมได้'
        ]
      },
      {
        name: 'ภาพรวมเครือข่าย',
        desc: 'สรุปสถานะอุปกรณ์เครือข่ายทุกสำนักงาน พร้อมรายการที่ควรตรวจสอบก่อน',
        steps: [
          'เปิดเมนู "ภาพรวมเครือข่าย" — หัวข้อแสดงสถานะการเชื่อมต่อ (เชื่อมต่อสำเร็จ/ขาดการเชื่อมต่อ) และเวลาที่โหลดข้อมูลล่าสุด แยกจากเวลาที่ตรวจวัดแต่ละอุปกรณ์ กดปุ่ม "รีเฟรช" เพื่อโหลดใหม่ได้ทันที',
          'การ์ดสรุป 3 ใบ: อุปกรณ์ทั้งหมด / ออนไลน์ / ขัดข้อง — กดการ์ด "ทั้งหมด" หรือ "ออนไลน์" เพื่อไปหน้า "อุปกรณ์ทั้งหมด" พร้อมตัวกรองสถานะที่ตรงกัน กดการ์ด "ขัดข้อง" เพื่อไปหน้ารายการขัดข้องโดยตรง — ด้านล่างการ์ดแสดงค่าเฉลี่ย latency และ packet loss พร้อมจำนวนอุปกรณ์ที่มีค่าจริงกำกับไว้',
          'ตาราง "อุปกรณ์ที่ควรตรวจสอบ" แสดงอุปกรณ์ที่ขัดข้อง หรือมี packet loss/latency สูงกว่าเกณฑ์ปฏิบัติงานเบื้องต้น เรียงตามความรุนแรง — กดชื่อสำนักงานเพื่อดูรายละเอียด หรือกด "ดูทั้งหมด" เพื่อไปหน้า "อุปกรณ์ทั้งหมด"',
          'กราฟแนวโน้ม Latency และ Packet Loss แยกกราฟกัน แสดงช่วงเวลาที่มีข้อมูลจริงกำกับไว้ ไม่ลากเส้นผ่านช่วงที่ไม่มีข้อมูล',
          'หากโหลดข้อมูลล่าสุดไม่สำเร็จ ระบบจะแจ้งเตือนและยังคงแสดงข้อมูลจากการโหลดครั้งก่อนไว้ให้ดูต่อได้'
        ]
      },
      {
        name: 'ประวัติการขัดข้อง',
        desc: 'ประวัติเหตุการณ์อุปกรณ์เครือข่ายขัดข้อง (down) ย้อนหลัง',
        steps: [
          'เปิดเมนู "ประวัติการขัดข้อง"',
          'ดูกราฟสรุปแนวโน้มด้านบนเพื่อดูภาพรวมจำนวนครั้ง/ระยะเวลาที่ขัดข้องรายเดือน',
          'ใช้ช่องค้นหาชื่ออุปกรณ์และ dropdown "จังหวัด" เพื่อกรองรายการ (ช่องที่มีการกรองจะไฮไลต์กรอบสีม่วง)',
          'คลิกหัวตารางเพื่อเรียงลำดับตามคอลัมน์นั้น'
        ]
      },
      {
        name: 'อุปกรณ์ทั้งหมด',
        desc: 'รายการอุปกรณ์เครือข่ายทั้งหมด พร้อมค่า latency และ packet loss',
        steps: [
          'เปิดเมนู "อุปกรณ์ทั้งหมด"',
          'เลือกประเภทสำนักงาน สถานะ (ทุกสถานะ/ออนไลน์/ขัดข้อง/ไม่ทราบสถานะ) หรือค้นหาด้วยชื่อสำนักงาน จังหวัด IP หรือ up / down และกด "ล้างตัวกรอง" เพื่อดูทั้งหมด',
          'คลิกหัวตารางเพื่อเรียงลำดับ เช่น latency, packet loss, สถานะ',
          'กดปุ่ม "ส่งออกทั้งหมด (Excel)" เพื่อดาวน์โหลดอุปกรณ์ทั้งหมด ไม่จำกัดตามตัวกรองหรือหน้าตาราง โดยแสดง IP เฉพาะผู้ที่เข้าสู่ระบบ',
          'กดชื่อสำนักงานเพื่อดูรายละเอียด เมื่อกลับมาหรือรีเฟรชในแท็บเดิม ระบบจะจำคำค้น ประเภทสำนักงาน สถานะ การเรียงลำดับ จำนวนรายการต่อหน้า และหน้าตาราง พร้อมโหลดข้อมูลล่าสุด',
          'ข้อมูลอัปเดตอัตโนมัติทุก 1 นาที หรือกด "รีเฟรช" หากโหลดไม่สำเร็จจะมีข้อความแจ้งและปุ่ม "ลองใหม่" โดยเก็บข้อมูลที่โหลดสำเร็จครั้งก่อนไว้'
        ]
      }
    ]
  },
  {
    title: 'ระบบคอมพิวเตอร์',
    icon: Cpu,
    color: '#a855f7',
    items: [
      {
        name: 'ยืมอุปกรณ์',
        desc: 'เลือกอุปกรณ์ที่ต้องการยืมลงตระกร้า แล้วยืนยันการยืมพร้อมกันได้หลายชิ้น (ต้องเข้าสู่ระบบเพื่อยืม)',
        steps: [
          'เปิดเมนู "ยืมอุปกรณ์" (ดูรายการอุปกรณ์ได้โดยไม่ต้องเข้าสู่ระบบ)',
          'ใช้ช่องค้นหาและตัวกรอง (ประเภท / แผนก / สถานะ / สำนักงาน) เพื่อหาอุปกรณ์ที่ต้องการ — ทุกช่องพิมพ์ค้นหาได้ทันทีจากรายการแนะนำ ต้องเลือกให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะกรองตามนั้นได้',
          'กดชื่ออุปกรณ์เพื่อดูรายละเอียด หรือกดปุ่ม "เพิ่มลงตระกร้า" ที่อุปกรณ์แต่ละชิ้นที่ต้องการยืม (เลือกได้หลายชิ้นพร้อมกัน) — อุปกรณ์ที่ถูกยืมอยู่จะกดเพิ่มลงตระกร้าไม่ได้ — เมื่อกลับมาจากหน้ารายละเอียด (หรือรีเฟรชในแท็บเดิม) ระบบจะจำคำค้น ตัวกรอง หน้าตาราง และรายการในตระกร้าไว้ให้',
          'กดไอคอนตระกร้าเพื่อเปิดดูรายการที่เลือกไว้ ลบรายการที่ไม่ต้องการออกได้จากตรงนี้',
          'หากยังไม่เข้าสู่ระบบ ระบบจะให้เข้าสู่ระบบก่อนดำเนินการต่อ',
          'กรอกข้อมูลผู้ยืม (ชื่อ, รหัสพนักงาน, เบอร์ติดต่อ, กำหนดคืน) แล้วกดยืนยันการยืม — ระบบจะตรวจสอบสถานะอุปกรณ์ในตระกร้าอีกครั้งก่อนแสดงหน้ายืนยัน หากมีชิ้นใดถูกผู้อื่นยืมไปแล้วจะถูกนำออกจากตระกร้าและแจ้งเตือนให้ทราบ',
          'ระบบจะมี pop-up ให้ยืนยันอีกครั้งก่อนบันทึกการยืมจริง'
        ]
      },
      {
        name: 'ประวัติการยืม',
        desc: 'ประวัติการยืม-คืนอุปกรณ์ทั้งหมด กดคืนอุปกรณ์ที่ตนเองยืม (หรือดำเนินการแทน) ได้จากหน้านี้',
        steps: [
          'เปิดเมนู "ประวัติการยืม"',
          'ใช้ช่องค้นหาและตัวกรอง (สถานะ ยังไม่คืน/คืนแล้ว, สำนักงาน) เพื่อหารายการที่ต้องการ',
          'รายการที่ยืมพร้อมกันในครั้งเดียว (batch เดียวกัน) จะแสดงกลุ่มติดกัน',
          'กดปุ่ม "คืน" ที่รายการที่ยังไม่คืน เพื่อบันทึกการคืนอุปกรณ์ (ต้องเข้าสู่ระบบ)',
          'ปุ่ม "คืน" จะกดได้เฉพาะผู้ที่เป็นคนยืมเอง หรือเป็นคนบันทึกรายการยืมนั้น หรือ super_admin เท่านั้น'
        ]
      },
      {
        name: 'ค้นหาอุปกรณ์คอมพิวเตอร์',
        desc: 'ค้นหาอุปกรณ์คอมพิวเตอร์/สำนักงานจากชื่อหรือรายละเอียดอื่นๆ ได้โดยไม่ต้องเข้าสู่ระบบ',
        steps: [
          'เปิดเมนู "ค้นหาอุปกรณ์"',
          'พิมพ์ชื่ออุปกรณ์ในช่องค้นหา หรือพิมพ์ในช่องตัวกรอง (ประเภท / แผนก / สถานะ / สำนักงาน) เพื่อจำกัดผลลัพธ์ — ทุกช่องพิมพ์ค้นหาได้ทันที ไม่ต้องเลือกจาก dropdown',
          'ช่อง "สำนักงาน" ต้องพิมพ์หรือเลือกชื่อให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะกรองตามสำนักงานนั้นได้',
          'กดปุ่ม "ตัวกรองขั้นสูง" เพื่อเปิดช่องค้นหาเพิ่มเติม เช่น ผู้ผลิต, Serial Number, รหัสทรัพย์สิน, ผู้ถือครอง, IP/MAC Address, เลขที่สัญญา, หมายเหตุ',
          'ใส่ตัวกรองพร้อมกันได้หลายช่อง ผลลัพธ์จะแคบลงตามเงื่อนไขทั้งหมดที่ใส่ (AND)',
          'ผลการค้นหาแต่ละแถวจะแสดงรหัสพนักงาน/ชื่อผู้ถือครองอุปกรณ์ด้วย',
          'กดชื่ออุปกรณ์เพื่อดูรายละเอียด เมื่อกลับมาหรือรีเฟรชในแท็บเดิม ระบบจะจำตัวกรองและหน้าตาราง พร้อมโหลดข้อมูลล่าสุด',
          'กดปุ่ม "ล้างตัวกรอง" เพื่อล้างเงื่อนไขการค้นหาทั้งหมด',
          'กดปุ่ม "ส่งออกผลการค้นหา (Excel)" เพื่อดาวน์โหลดผลการค้นหาปัจจุบันทั้งหมดตามตัวกรอง ไม่ใช่แค่หน้าที่กำลังแสดง โดยรอให้ค้นหาเสร็จก่อน',
          'กด "รีเฟรช" เพื่อโหลดข้อมูลล่าสุด หากค้นหาไม่สำเร็จจะมีปุ่ม "ลองใหม่" และหากชื่อสำนักงานไม่ตรงรายการแนะนำ จะมีข้อความบอกว่ายังไม่ได้กรองสำนักงาน'
        ]
      }
    ]
  },
  {
    title: 'แจ้งปัญหา',
    icon: ClipboardList,
    color: '#f97316',
    items: [
      {
        name: 'แจ้งปัญหา',
        desc: 'แจ้งปัญหาอุปกรณ์หรือระบบให้ทีมงานดำเนินการแก้ไข ดูรายการและติดตามสถานะได้โดยไม่ต้องเข้าสู่ระบบ (การแจ้งเรื่องใหม่ต้องเข้าสู่ระบบก่อน)',
        steps: [
          'เปิดเมนู "แจ้งปัญหา" — ดูรายการงานที่แจ้งไว้ทั้งหมดพร้อมสถานะและความสำคัญได้ทันทีโดยไม่ต้องเข้าสู่ระบบ',
          'ใช้ช่องค้นหาและตัวกรอง (สำนักงาน / สถานะ / ประเภทงาน / ความสำคัญ) เพื่อหารายการที่ต้องการ — ช่องกรองสำนักงานพิมพ์ค้นหาได้ ต้องพิมพ์หรือเลือกชื่อให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะกรองตามสำนักงานนั้นได้ — กดปุ่ม "ล้างตัวกรอง" เพื่อล้างเงื่อนไขทั้งหมด',
          'กดชื่องานเพื่อเปิดรายละเอียด — แต่ละงานมีลิงก์ของตัวเอง จึงย้อนกลับ/ไปข้างหน้าด้วยปุ่ม Back/Forward ของเบราว์เซอร์ รีเฟรชหน้า หรือเปิดลิงก์ตรงจากที่อื่นได้ตามปกติ — กด "กลับไปยังรายการแจ้งปัญหา" เพื่อย้อนกลับ ระบบจะจำคำค้นและตัวกรองเดิมไว้ให้',
          'หน้ารายละเอียดแบ่งเป็นส่วนอ่านง่าย: ปัญหาที่แจ้ง, การดำเนินการ (ผู้รับผิดชอบ, เลขที่คำสั่งปฏิบัติงาน, หมายเหตุความคืบหน้า, หมายเหตุปิดงาน หรือเหตุผลที่ยกเลิกตามสถานะจริง), อุปกรณ์ที่มีปัญหา, อุปกรณ์ที่ใช้ดำเนินการ (แยกจากกันชัดเจน) และคอลัมน์ข้างแสดงสำนักงาน/ผู้แจ้งและเอกสารแนบ — ถ้ามีไฟล์หนังสือแจ้งหรือรายงานผลแนบไว้ จะแสดงเป็น preview เล็กในหน้ารายละเอียดทันที คลิกเพื่อดูแบบเต็มจอในหน้าเดิม ไม่เปิดแท็บใหม่ และเลื่อนดูรูปหลังดำเนินการรูปถัดไป/ก่อนหน้าได้ในหน้าเดียวกัน',
          'เมื่องานเสร็จแล้ว หน้ารายละเอียดจะยังแสดงอุปกรณ์ที่ใช้ดำเนินการ รูปหลังดำเนินการ และธุรกรรมงบประมาณที่ผูกไว้ด้วย',
          'กดปุ่ม "แจ้งปัญหาใหม่" — หากยังไม่เข้าสู่ระบบ ระบบจะพาไปหน้าเข้าสู่ระบบก่อน',
          'กรอกข้อมูลงาน (ชื่องาน, สำนักงาน, ประเภทงาน, ความสำคัญ, รายละเอียด), ข้อมูลผู้แจ้ง และเลือกอุปกรณ์ที่มีปัญหาจากสาขาที่เลือกไว้ — พิมพ์คำค้นหา (หรือเว้นว่างไว้) แล้วกดปุ่ม "ค้นหา" ระบบจะไม่ดึงรายการอุปกรณ์มาให้อัตโนมัติจนกว่าจะกดค้นหา จากนั้นคลิกรายการเพื่อเพิ่ม/เอาออกได้',
          'ช่อง "สำนักงาน" พิมพ์ค้นหาได้ทันที — ต้องพิมพ์หรือเลือกชื่อให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะค้นหาอุปกรณ์ของสาขานั้นได้',
          'แนบไฟล์หนังสือแจ้งได้ (รูปภาพหรือ PDF ไม่เกิน 5MB) ที่ช่อง "ไฟล์หนังสือแจ้ง" — ไม่บังคับ',
          'กดปุ่ม "ส่งเรื่องแจ้งปัญหา" เพื่อบันทึก — งานจะเริ่มต้นที่สถานะ "เปิดงาน" เสมอ',
          'ทีมงานจะดำเนินการต่อ (เริ่มดำเนินการ/ปิดงาน/ยกเลิก) ผ่านหน้า "จัดการงาน" ในเมนู "การจัดการ"'
        ]
      }
    ]
  },
  {
    title: 'การจัดการ (ต้องเข้าสู่ระบบ)',
    icon: Boxes,
    color: '#f59e0b',
    items: [
      {
        name: 'จัดการอุปกรณ์คอมพิวเตอร์',
        desc: 'เพิ่ม ลบ แก้ไข อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วงของแต่ละสำนักงาน',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "การจัดการอุปกรณ์คอมพิวเตอร์"',
          'เลือกสำนักงานจากรายการ (ค้นหาชื่อ/จังหวัดได้) เพื่อดูอุปกรณ์ของสำนักงานนั้น — รายชื่อสำนักงานแบ่งหน้า ปรับจำนวนที่แสดงต่อหน้าและเลือกหน้าที่ต้องการดูได้',
          'ใช้ตัวกรอง "ประเภท" และช่องค้นหาเพื่อจำกัดรายการ (กรอบไฮไลต์เมื่อมีการกรอง) — ปรับจำนวนที่แสดงต่อหน้าและเลือกหน้าที่ต้องการดูได้จากแถบด้านล่างตาราง',
          'กดปุ่ม "เพิ่มอุปกรณ์" เพื่อเพิ่มรายการใหม่ — ระบบจะแนะนำช่วง IP ที่ควรใช้ตามแผนก/ประเภทอุปกรณ์ให้อัตโนมัติ',
          'คลิกแถวอุปกรณ์เพื่อดูรายละเอียด หรือกดไอคอนแก้ไข/ลบท้ายแถว',
          'หน้าแก้ไขอุปกรณ์บน desktop แบ่งฟอร์มสองคอลัมน์และมีแถบบันทึกติดขอบล่างขณะเลื่อน ส่วนมือถือใช้คอลัมน์เดียว — หน้ารายละเอียดอุปกรณ์บน desktop แสดงข้อมูลสองคอลัมน์ พร้อมปุ่มยืม/คืน ประวัติผู้ถือครอง และแก้ไขด้านบน ส่วนมือถือแสดงคอลัมน์เดียว — ในหน้ารายละเอียดอุปกรณ์ กดปุ่ม QR Code เพื่อดู/ดาวน์โหลด QR หรือกด "ประวัติผู้ถือครอง" เพื่อดูประวัติการเปลี่ยนผู้ถือครอง — คลิกรูปภาพอุปกรณ์หรือรูปสถานที่จัดเก็บเพื่อดูแบบเต็มจอในหน้าเดิม เลื่อนดูรูปถัดไป/ก่อนหน้าได้ด้วยปุ่มลูกศรหรือคีย์บอร์ด',
          'หน้ารายละเอียดอุปกรณ์ยังแสดง "ประวัติการแจ้งปัญหา/ซ่อม" (งานที่แจ้งว่าอุปกรณ์ชิ้นนี้มีปัญหา) และ "งานที่นำอุปกรณ์นี้ไปใช้ดำเนินการ" (งานที่ใช้อุปกรณ์ชิ้นนี้ซ่อม/ดำเนินการเรื่องอื่น) แยกกัน หากมีข้อมูล',
          'กดปุ่ม Export Excel เพื่อดาวน์โหลดรายการอุปกรณ์ทั้งหมดของสำนักงานนั้น'
        ]
      },
      {
        name: 'จัดการอุปกรณ์เครือข่าย',
        desc: 'เพิ่ม ลบ แก้ไข ข้อมูลอุปกรณ์เครือข่าย (Network Devices)',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "การจัดการอุปกรณ์เครือข่าย"',
          'ใช้ตัวกรอง "ประเภท" และช่องค้นหาเพื่อจำกัดรายการอุปกรณ์',
          'กดปุ่มเพิ่มอุปกรณ์ใหม่ หรือกดแก้ไข/ลบที่แถวอุปกรณ์ที่ต้องการ'
        ]
      },
      {
        name: 'จัดการงบประมาณ',
        desc: 'ตรวจสอบและจัดการข้อมูลรายจ่าย งบประมาณ และรหัสบัญชีของหน่วยงาน',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "จัดการงบประมาณ"',
          'ดูรายการงบประมาณ/รายจ่าย พร้อมเพิ่ม แก้ไข หรือลบรายการได้ตามสิทธิ์ผู้ใช้งาน'
        ]
      },
      {
        name: 'จัดการงาน',
        desc: 'หน้าหลังบ้านสำหรับดำเนินการงานที่มีผู้แจ้งเข้ามา ติดตามสถานะ และประมวลผลตามขั้นตอนงาน (การแจ้งงานใหม่ทำได้ที่เมนู "แจ้งปัญหา" ไม่ใช่หน้านี้)',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "จัดการงาน"',
          'หน้ารายการงานรองรับการค้นหา (ชื่องาน/รายละเอียด), กรองตามสำนักงาน/สถานะ/ประเภทงาน/ความสำคัญ และแบ่งหน้า — ช่องกรองสำนักงานพิมพ์ค้นหาได้ ต้องพิมพ์หรือเลือกชื่อให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะกรองตามสำนักงานนั้นได้ ตารางแสดงคอลัมน์สำนักงานแทนจังหวัด — คอลัมน์ชื่องาน/รายละเอียดงาน/สำนักงานแสดงแค่ 1 บรรทัด ถ้าข้อความยาวจะตัดเป็น "..." วางเมาส์ค้างเพื่อดูข้อความเต็ม',
          'คลิกแถวงานเพื่อดูรายละเอียด (ข้อมูลงาน สถานะ อุปกรณ์ที่มีปัญหา และธุรกรรมงบประมาณที่ผูกกับงานนั้น) — หน้ารายละเอียดแสดงข้อมูลตามสถานะเพิ่มเติมด้วย เช่น ผู้รับผิดชอบ เลขที่คำสั่งปฏิบัติงาน หมายเหตุความคืบหน้า หมายเหตุปิดงาน หรือเหตุผลที่ยกเลิก',
          'แต่ละแถวมีปุ่มไอคอนสำหรับดูประวัติของงาน (role: super_admin, network_admin, computer_admin, operator), แก้ไขงาน (แสดงเมื่อสถานะเป็นเปิดงาน ยกเว้น super_admin แก้ไขได้ทุกสถานะ) และลบงาน (super_admin เท่านั้น — ต้องยืนยันก่อนลบ และย้อนกลับไม่ได้)',
          'งานมีสถานะไล่ลำดับ: เปิดงาน → ระหว่างดำเนินการ → เสร็จงาน (ข้ามขั้นไม่ได้) หรือยกเลิกได้จากสถานะเปิดงาน/ระหว่างดำเนินการ',
          'กดปุ่ม "เริ่มดำเนินการ" (จากสถานะเปิดงาน) เพื่อระบุผู้รับผิดชอบและเลขที่คำสั่งปฏิบัติงาน — แถวผู้รับผิดชอบแรกดึงชื่อและรหัสพนักงานจากผู้ใช้ที่ล็อกอินอยู่ให้อัตโนมัติ (แก้ไข/ลบได้) และระบุผู้รับผิดชอบเพิ่มได้หลายคนโดยกดปุ่ม "เพิ่มผู้รับผิดชอบ"',
          'กดปุ่ม "ปิดงาน" (จากสถานะระหว่างดำเนินการ) พร้อมระบุหมายเหตุปิดงาน เพื่อเปลี่ยนเป็นเสร็จงาน — ในหน้าต่างเดียวกัน แนบไฟล์รายงานผลการดำเนินการ (รูปภาพ/PDF ไม่เกิน 5MB), เลือกอุปกรณ์ที่ใช้ดำเนินการ, แนบรูปหลังดำเนินการ (สูงสุด 5 รูป) และผูกธุรกรรมงบประมาณที่เกี่ยวข้องได้ด้วย (ทุกอย่างไม่บังคับ ยกเว้นหมายเหตุปิดงาน) — ทั้งช่องค้นหาอุปกรณ์และช่องค้นหาธุรกรรมต้องกดปุ่ม "ค้นหา" เอง ระบบจะไม่ดึงรายการมาให้อัตโนมัติเมื่อเปิดหน้าต่าง — ถ้ามีไฟล์รายงานแนบไว้ จะแสดงให้ดูได้ทันทีในหน้ารายละเอียดงาน',
          'กดปุ่ม "ยกเลิกงาน" พร้อมระบุเหตุผล เพื่อยกเลิกงาน (ทำได้เฉพาะจากสถานะเปิดงาน/ระหว่างดำเนินการ)',
          'ขณะสถานะยังเป็นเปิดงาน กดไอคอนดินสอที่การ์ดสถานะ (หรือที่แถวในตาราง) เพื่อแก้ไขข้อมูลงานหรือแนบ/เปลี่ยนไฟล์หนังสือแจ้งได้ — super_admin แก้ไขได้ทุกสถานะ ไม่จำกัดแค่เปิดงาน',
          'หากมีไฟล์หนังสือแจ้งแนบไว้ จะแสดงในหน้ารายละเอียดงานทันที — ไฟล์รูปภาพแสดงเป็นรูปให้คลิกดูได้เลย ส่วนไฟล์ PDF แสดงเป็นกล่อง preview ขนาดเล็ก กดเพื่อขยายดูแบบเต็มจอ — คลิกรูปภาพ (ไฟล์หนังสือแจ้ง, รายงานผลการดำเนินการ, หรือรูปหลังดำเนินการ) หรือกล่อง PDF เพื่อดูแบบเต็มจอในหน้าเดิม ไม่เปิดแท็บใหม่ และเลื่อนดูรูปหลังดำเนินการรูปถัดไป/ก่อนหน้าได้ในหน้าเดียวกัน',
          'ปุ่มดำเนินการเหล่านี้แสดงเฉพาะผู้ใช้ role: super_admin, network_admin, computer_admin, operator เท่านั้น',
          'ฟิลด์ที่แก้ไขได้ในฟอร์มแก้ไขงานต่างกันตาม role — role อื่น (network_admin, computer_admin, operator) แก้ได้เฉพาะข้อมูลงาน/ผู้แจ้ง ส่วน super_admin เห็น section เพิ่ม "แก้ไขข้อมูลขั้นสูง" ท้ายฟอร์ม สำหรับแก้สำนักงาน สถานะ หมายเหตุความคืบหน้า เลขที่คำสั่งปฏิบัติงาน หมายเหตุปิดงาน เหตุผลที่ยกเลิก และ path ไฟล์แนบโดยตรง (ควรใช้ปุ่มดำเนินการปกติแทนหากทำได้ ส่วนนี้ไว้แก้ข้อมูลผิดพลาด)'
        ]
      },
      {
        name: 'จัดการคลังอุปกรณ์ (Stock)',
        desc: 'ดูรายการอุปกรณ์สำนักงานทั้งหมดในทุกสำนักงาน แบ่งตามคลังจัดเก็บ',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "จัดการคลังอุปกรณ์ (Stock)"',
          'เลือกแท็บคลังจัดเก็บที่ต้องการดู (โรงเก็บของใต้บันได / อาคาร กรย. / แผนกคอมพิวเตอร์และเครือข่าย / อื่นๆ) — แต่ละแท็บมีจำนวนอุปกรณ์กำกับไว้',
          'ใช้ช่องค้นหาและตัวกรอง (สถานะ, สำนักงานในแท็บ "อื่นๆ") เพื่อจำกัดรายการ — ช่องกรองสำนักงานพิมพ์ค้นหาได้ ต้องพิมพ์หรือเลือกชื่อให้ตรงกับรายการที่ขึ้นแนะนำเป๊ะๆ ระบบจึงจะกรองตามสำนักงานนั้นได้ — ตารางแสดงคอลัมน์รหัสทรัพย์สิน, Serial Number และผู้ถือครอง ของแต่ละรายการด้วย — แต่ละแถวแสดงข้อมูลบรรทัดเดียว ถ้าข้อความยาวจะตัดเป็น "..." วางเมาส์ค้างเพื่อดูข้อความเต็ม',
          'กดปุ่ม "พิมพ์ QR-Code (สร้างใหม่)" เพื่อสร้างอุปกรณ์เปล่าจำนวนที่ต้องการและพิมพ์สติกเกอร์ QR ไปติดกับอุปกรณ์จริงก่อนกรอกข้อมูล',
          'กดปุ่ม "เพิ่ม Stock" เพื่อเพิ่มอุปกรณ์ใหม่พร้อมกรอกข้อมูลได้ทันที',
          'แต่ละแถวมีไอคอนสำหรับดู QR / ยืม-คืน / ประวัติการยืม-คืน / ลบ (ตามสิทธิ์ผู้ใช้งาน)',
          'ติ๊กช่องด้านหน้าแต่ละแถวเพื่อเลือกอุปกรณ์ที่มีอยู่แล้วหลายรายการพร้อมกัน (ติ๊กช่องที่หัวตารางเพื่อเลือก/ยกเลิกทั้งหมดในหน้านั้น — การเลือกจะอยู่ต่อเนื่องแม้เปลี่ยนหน้า) แล้วกดปุ่ม "พิมพ์ QR ที่เลือก" ที่ปรากฏขึ้นเพื่อพิมพ์ QR ของอุปกรณ์ที่เลือกไว้ทั้งหมดในครั้งเดียว (ต่างจาก "พิมพ์ QR-Code (สร้างใหม่)" ตรงที่ใช้กับอุปกรณ์ที่มีอยู่แล้ว ไม่สร้างรายการใหม่)',
          'ท้ายตารางมีตัวเลือกหน้า — เลือกหมายเลขหน้าที่ต้องการดูได้โดยตรง ไม่ต้องกดถัดไป/ก่อนหน้าไปทีละหน้า'
        ]
      },
      {
        name: 'การตั้งค่าระบบ',
        desc: 'จัดการผู้ใช้งานและสิทธิ์การเข้าถึงระบบ (super_admin / manager เท่านั้น)',
        steps: [
          'เปิดเมนู "การจัดการ" > "การตั้งค่าระบบ" (แสดงเฉพาะบัญชี super_admin และ manager)',
          'ค้นหาผู้ใช้งานด้วยชื่อ / username / สาขา',
          'แก้ไขข้อมูลหรือสิทธิ์ (role) ของผู้ใช้งาน หรือลบบัญชีผู้ใช้งานได้จากหน้านี้'
        ]
      }
    ]
  }
];

const About = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  // Item names are unique across every GUIDE_SECTIONS group, so the name
  // itself is a fine key for tracking which cards are expanded.
  const [expandedGuideItems, setExpandedGuideItems] = useState({});
  const toggleGuideItem = (name) => setExpandedGuideItems(prev => ({ ...prev, [name]: !prev[name] }));

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stats/summary`);
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error('Failed to fetch stats summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const stats = [
    { label: 'Online Users', value: summary?.data?.online_users ?? '0', icon: Users, color: '#10b981' },
    { label: 'Visits Today', value: (summary?.data?.views_today ?? 0).toLocaleString(), icon: Calendar, color: '#3b82f6' },
    { label: 'Visits This Month', value: (summary?.data?.views_month ?? 0).toLocaleString(), icon: Clock, color: '#eab308' },
    { label: 'Total Site Visits', value: (summary?.data?.total_views ?? 0).toLocaleString(), icon: Eye, color: '#a855f7' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ paddingBottom: '3rem' }}
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 className="krub-bold" style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>About This Project</h1>
        <p className="krub-regular" style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>
          ระบบตรวจสอบ LAN Devices
        </p>
      </header>

      {/* System User Guide */}
      <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: '#eab308' }}>
            <BookOpen size={28} />
          </div>
          <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>คู่มือการใช้งานระบบ</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {GUIDE_SECTIONS.map((section) => (
            <div key={section.title}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <div style={{ color: section.color, display: 'flex' }}>
                  <section.icon size={18} />
                </div>
                <h3 className="krub-semibold" style={{ margin: 0, fontSize: '1rem', color: section.color }}>{section.title}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {section.items.map((item) => {
                  const expanded = !!expandedGuideItems[item.name];
                  return (
                    <div
                      key={item.name}
                      style={{ padding: '0.9rem 1rem', background: 'var(--glass-bg-subtle)', borderRadius: '0.75rem', border: '1px solid var(--border-subtle)', alignSelf: 'start' }}
                    >
                      <div className="krub-semibold" style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>{item.name}</div>
                      <div className="krub-regular" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>

                      {item.steps && item.steps.length > 0 && (
                        <>
                          <button
                            onClick={() => toggleGuideItem(item.name)}
                            className="krub-medium"
                            style={{
                              marginTop: '0.6rem', padding: 0, background: 'none', border: 'none', color: section.color,
                              fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                            }}
                          >
                            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                            {expanded ? 'ซ่อนวิธีใช้งานโดยละเอียด' : 'ดูวิธีใช้งานโดยละเอียด'}
                          </button>

                          {expanded && (
                            <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {item.steps.map((step, i) => (
                                <li key={i} className="krub-regular" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Creator Information Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: 'var(--accent-primary)' }}>
              <User size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>ผู้จัดทำ</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                TB
              </div>
              <div>
                <div className="krub-bold" style={{ fontSize: '1.1rem' }}>นายธนทัต บูระพันธ์</div>
                <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Thanatat Boorapan</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--glass-bg-subtle)', borderRadius: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--accent-primary)' }}><ShieldCheck size={18} /></div>
                <div>
                  <div className="krub-semibold" style={{ fontSize: '0.9rem' }}>ตำแหน่ง</div>
                  <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>นักระบบงานคอมพิวเตอร์</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--glass-bg-subtle)', borderRadius: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--accent-primary)' }}><Globe size={18} /></div>
                <div>
                  <div className="krub-semibold" style={{ fontSize: '0.9rem' }}>สังกัด</div>
                  <div className="krub-regular" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผคข.กดส.ฉ.2 (การไฟฟ้าส่วนภูมิภาคเขต 2 ภาคตะวันออกเฉียงเหนือ)</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--bg-accent-subtle)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                <div style={{ color: 'var(--accent-primary)' }}><Info size={18} /></div>
                <div>
                  <div className="krub-regular" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    หากพบข้อมูลไม่ถูกต้องหรือไม่ครบถ้วน กรุณาติดต่อ <strong style={{ color: 'var(--accent-primary)' }}>(22)10369</strong> เพื่อเร่งดำเนินการแก้ไขโดยเร็วที่สุด
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Site Statistics Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: '#3b82f6' }}>
              <BarChart size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>Site Viewer Statistics</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', position: 'relative', minHeight: '180px' }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '1rem', backdropFilter: 'blur(2px)' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
              </div>
            ) : null}

            {stats.map((stat, idx) => (
              <div key={idx} className="glass" style={{ padding: '1.25rem', borderRadius: '1rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: stat.color, marginBottom: '0.75rem' }}>
                  <stat.icon size={20} />
                </div>
                <div className="krub-bold" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{stat.value}</div>
                <div className="krub-regular" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <History size={16} color="#3b82f6" />
            <span>Operational metrics synchronized with real-time backend analytics.</span>
          </div>
        </motion.div>

        {/* Project Technical Details Card */}
        <motion.div variants={itemVariants} className="card glass" style={{ padding: '2.5rem', gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '1rem', color: '#10b981' }}>
              <Code2 size={28} />
            </div>
            <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.5rem' }}>Technical Stack</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
              <span className="krub-medium">React (Vite)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)' }} />
              <span className="krub-medium">Framer Motion</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              <span className="krub-medium">Recharts API</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span className="krub-medium">Lucide Icons</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', opacity: 0.5 }}>
            <img src={peaLogo} alt="PEA Logo" style={{ width: '80px', filter: 'grayscale(1)' }} />
            <div className="krub-medium" style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>Version 1.2.0 • 2026</div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default About;
