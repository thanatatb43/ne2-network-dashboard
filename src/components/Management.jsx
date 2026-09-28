import { Monitor, Network, Activity, ArrowLeft, Wallet, ClipboardList, Boxes } from 'lucide-react';
import NavCards from './common/NavCards.jsx';
import './ListPage.css';
import { motion, AnimatePresence } from 'framer-motion';
import NetworkDeviceManagement from './NetworkDeviceManagement';
import BudgetManagement from './BudgetManagement';
import JobManagement from './JobManagement';
import OfficeEquipmentManagement from './OfficeEquipmentManagement';
import StockManagement from './StockManagement';
import NetworkTestHistory from './NetworkTestHistory';

const Management = ({ user, token, onDeviceClick, onEquipmentClick, onAddStock, onRequireLogin, view = 'overview', siteId = null, onViewChange }) => {
  // URL-controlled from App.jsx (setView keeps the many existing call sites unchanged)
  const setView = (v) => (onViewChange ? onViewChange(v) : undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="management-page"
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }} className="krub-bold">การจัดการ</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }} className="krub-regular">เพิ่ม ลบ แก้ไข จัดการงานและอุปกรณ์</p>
      </header>

      <AnimatePresence mode="wait">
        {view === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <NavCards label="ส่วนการจัดการ" items={[
              { key: 'computer_management', href: '/management/computers', tone: 'blue', icon: <Monitor size={28} />, title: 'จัดการอุปกรณ์คอมพิวเตอร์', subtitle: 'อุปกรณ์คอมพิวเตอร์ในสำนักงาน', desc: 'ตรวจสอบ เพิ่ม ลบ แก้ไข อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วงระบบเครือข่ายภายในสำนักงาน', action: 'ไปที่หน้าจัดการคอมพิวเตอร์', onNavigate: () => setView('computer_management') },
              { key: 'network', href: '/management/network', tone: 'teal', icon: <Network size={28} />, title: 'จัดการอุปกรณ์เครือข่าย', subtitle: 'อุปกรณ์เครือข่ายและประวัติการทดสอบ', desc: 'ตรวจสอบ เพิ่ม ลบ แก้ไข อุปกรณ์เครือข่ายภายในสำนักงาน และดูประวัติการทดสอบความเร็ว', action: 'ไปที่หน้าจัดการเครือข่าย', onNavigate: () => setView('network') },
              { key: 'budget_management', href: '/management/budget', tone: 'purple', icon: <Wallet size={28} />, title: 'จัดการงบประมาณ', subtitle: 'งบประมาณและข้อมูลการเบิกจ่าย', desc: 'ดูและจัดการงบประมาณรายเดือนของแต่ละบัญชี และนำเข้าข้อมูลการเบิกจ่ายจากไฟล์', action: 'ไปที่หน้าจัดการงบประมาณ', onNavigate: () => setView('budget_management') },
              { key: 'job_management', href: '/management/jobs', tone: 'amber', icon: <ClipboardList size={28} />, title: 'จัดการงาน', subtitle: 'งานจากการแจ้งปัญหา', desc: 'ติดตามงานแจ้งปัญหา เปลี่ยนสถานะงาน และผูกธุรกรรมงบประมาณกับงาน', action: 'ไปที่หน้าจัดการงาน', onNavigate: () => setView('job_management') },
              { key: 'stock_management', href: '/management/stock', tone: 'pink', icon: <Boxes size={28} />, title: 'จัดการคลังอุปกรณ์ (Stock)', subtitle: 'ทะเบียนอุปกรณ์สำนักงานทั้งหมด', desc: 'ดูรายการอุปกรณ์สำนักงานทั้งหมดในทุกสำนักงาน ค้นหาและตรวจสอบรายละเอียดอุปกรณ์แต่ละชิ้น', action: 'ไปที่หน้าจัดการคลังอุปกรณ์', onNavigate: () => setView('stock_management') }
            ]} />
          </motion.div>
        )}

        {view === 'network' && (
          <motion.div key="network" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <a
              className="list-button mgmt-back"
              href="/management"
              onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); setView('overview'); } }}
            >
              <ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการจัดการ
            </a>
            <NavCards label="การจัดการเครือข่าย" items={[
              { key: 'network_history', href: '/management/network/history', tone: 'purple', icon: <Activity size={28} />, title: 'ประวัติการทดสอบความเร็ว', subtitle: 'ผลจากหน้า "ตรวจสอบการเชื่อมต่อ"', desc: 'ดูผลทดสอบความเร็ว Download/Upload เวลาตอบกลับ และเครื่องที่ทดสอบ', action: 'ดูประวัติการทดสอบ', onNavigate: () => setView('network_history') },
              { key: 'network_devices', href: '/management/network/devices', tone: 'blue', icon: <Network size={28} />, title: 'จัดการอุปกรณ์เครือข่าย', subtitle: 'Gateway และข้อมูลเครือข่ายของสำนักงาน', desc: 'เพิ่ม ลบ และแก้ไขข้อมูลอุปกรณ์เครือข่ายในระบบ', action: 'ไปที่หน้าจัดการอุปกรณ์', onNavigate: () => setView('network_devices') }
            ]} />
          </motion.div>
        )}

        {view === 'network_history' && (
          <NetworkTestHistory token={token} onBack={() => setView('network')} />
        )}

        {view === 'network_devices' && (
          <NetworkDeviceManagement token={token} onBack={() => setView('network')} user={user} onDeviceClick={onDeviceClick} />
        )}

        {view === 'budget_management' && (
          <BudgetManagement token={token} onBack={() => setView('overview')} user={user} />
        )}

        {view === 'job_management' && (
          <JobManagement
            token={token}
            user={user}
            jobId={siteId}
            onEquipmentClick={onEquipmentClick}
            onOpenJob={(id) => {
              onViewChange && onViewChange('job_management', id);
              // Marks the job page as opened from the list, so its back
              // button can return with history.back() (keeping the list's
              // place) instead of stacking another list entry.
              window.history.replaceState({ ...window.history.state, jmFromList: true }, '');
            }}
            onBack={() => {
              if (siteId && window.history.state?.jmFromList) window.history.back();
              else setView(siteId ? 'job_management' : 'overview');
            }}
          />
        )}

        {view === 'computer_management' && (
          <OfficeEquipmentManagement
            token={token}
            onBack={() => setView('overview')}
            user={user}
            selectedSiteId={siteId}
            onSelectSite={(id) => onViewChange && onViewChange('computer_management', id)}
          />
        )}

        {view === 'stock_management' && (
          <StockManagement
            token={token}
            user={user}
            onBack={() => setView('overview')}
            onEquipmentClick={onEquipmentClick}
            onAddStock={onAddStock}
            onRequireLogin={onRequireLogin}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Management;
