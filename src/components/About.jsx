import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Info, User, BarChart3, Globe, ShieldCheck, Cpu, Code2, Users, Eye, BarChart, History, Loader2, Calendar, Clock,
  BookOpen, Map, Network, Boxes, ChevronDown
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
        desc: 'สถานะและค่า latency ของอุปกรณ์เครือข่ายทุกสำนักงานแบบเรียลไทม์',
        steps: [
          'เปิดเมนู "ภาพรวมเครือข่าย"',
          'ด้านบนแสดงสรุปจำนวนอุปกรณ์ทั้งหมด/ออนไลน์/ออฟไลน์ พร้อมกราฟแนวโน้ม latency',
          'เลื่อนลงดูตารางอุปกรณ์ หรือกด "ดูทั้งหมด" เพื่อไปหน้า "อุปกรณ์ทั้งหมด"',
          'คลิกแถวอุปกรณ์เพื่อดูรายละเอียดของอุปกรณ์นั้น'
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
          'ใช้ dropdown "ประเภท" และช่องค้นหาเพื่อกรองอุปกรณ์ (กรอบไฮไลต์เมื่อมีการกรอง)',
          'คลิกหัวตารางเพื่อเรียงลำดับ เช่น latency, packet loss, สถานะ',
          'กดปุ่ม Export Excel เพื่อดาวน์โหลดรายการทั้งหมดเป็นไฟล์ .xlsx',
          'คลิกแถวอุปกรณ์เพื่อดูรายละเอียด'
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
          'ใช้ช่องค้นหาและตัวกรอง (ประเภท / แผนก / สถานะ / สำนักงาน) เพื่อหาอุปกรณ์ที่ต้องการ',
          'กดปุ่ม "เพิ่มลงตระกร้า" ที่อุปกรณ์แต่ละชิ้นที่ต้องการยืม (เลือกได้หลายชิ้นพร้อมกัน)',
          'กดไอคอนตระกร้าเพื่อเปิดดูรายการที่เลือกไว้ ลบรายการที่ไม่ต้องการออกได้จากตรงนี้',
          'หากยังไม่เข้าสู่ระบบ ระบบจะให้เข้าสู่ระบบก่อนดำเนินการต่อ',
          'กรอกข้อมูลผู้ยืม (ชื่อ, รหัสพนักงาน, เบอร์ติดต่อ, กำหนดคืน) แล้วกดยืนยันการยืม',
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
          'เลือกสำนักงานจากรายการ (ค้นหาชื่อ/จังหวัดได้) เพื่อดูอุปกรณ์ของสำนักงานนั้น',
          'ใช้ตัวกรอง "ประเภท" และช่องค้นหาเพื่อจำกัดรายการ (กรอบไฮไลต์เมื่อมีการกรอง)',
          'กดปุ่ม "เพิ่มอุปกรณ์" เพื่อเพิ่มรายการใหม่ — ระบบจะแนะนำช่วง IP ที่ควรใช้ตามแผนก/ประเภทอุปกรณ์ให้อัตโนมัติ',
          'คลิกแถวอุปกรณ์เพื่อดูรายละเอียด หรือกดไอคอนแก้ไข/ลบท้ายแถว',
          'ในหน้ารายละเอียดอุปกรณ์ กดปุ่ม QR Code เพื่อดู/ดาวน์โหลด QR หรือกด "ประวัติผู้ถือครอง" เพื่อดูประวัติการเปลี่ยนผู้ถือครอง',
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
        desc: 'ตรวจสอบและจัดการงานที่ได้รับมอบหมาย ติดตามสถานะและรายละเอียดของงานต่างๆ',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "จัดการงาน"',
          'หน้ารายการงานรองรับการค้นหา (ชื่องาน/รายละเอียด), กรองตามสำนักงาน และแบ่งหน้า',
          'กดปุ่ม "สร้างงานใหม่" เพื่อเพิ่มงาน กรอกชื่องาน สาขา PEA และรายละเอียด แล้วบันทึก',
          'คลิกแถวงานเพื่อดูรายละเอียด (ข้อมูลงาน สำนักงาน และธุรกรรมงบประมาณที่ผูกกับงานนั้น)'
        ]
      },
      {
        name: 'จัดการคลังอุปกรณ์ (Stock)',
        desc: 'ดูรายการอุปกรณ์สำนักงานทั้งหมดในทุกสำนักงาน แบ่งตามคลังจัดเก็บ',
        steps: [
          'ไปที่เมนู "การจัดการ" > "จัดการงานและอุปกรณ์" แล้วเลือกการ์ด "จัดการคลังอุปกรณ์ (Stock)"',
          'เลือกแท็บคลังจัดเก็บที่ต้องการดู (โรงเก็บของใต้บันได / อาคาร กรย. / แผนกคอมพิวเตอร์และเครือข่าย / อื่นๆ) — แต่ละแท็บมีจำนวนอุปกรณ์กำกับไว้',
          'ใช้ช่องค้นหาและตัวกรอง (สถานะ, สำนักงานในแท็บ "อื่นๆ") เพื่อจำกัดรายการ',
          'กดปุ่ม "พิมพ์ QR-Code" เพื่อสร้างอุปกรณ์เปล่าจำนวนที่ต้องการและพิมพ์สติกเกอร์ QR ไปติดกับอุปกรณ์จริงก่อนกรอกข้อมูล',
          'กดปุ่ม "เพิ่ม Stock" เพื่อเพิ่มอุปกรณ์ใหม่พร้อมกรอกข้อมูลได้ทันที',
          'แต่ละแถวมีไอคอนสำหรับดู QR / ยืม-คืน / ประวัติการยืม-คืน / ลบ (ตามสิทธิ์ผู้ใช้งาน)'
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
