import React from 'react';
import { Monitor, Network, ArrowRight, Activity, ArrowLeft, Loader2, RefreshCw, ChevronLeft, ChevronRight, Search, Wallet, ClipboardList, Boxes } from 'lucide-react';
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
          <motion.div 
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}
          >
            {/* Computer Management Card */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="card glass"
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(59, 130, 246, 0.2)' }}
              onClick={() => setView('computer_management')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}>
                  <Monitor size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">การจัดการอุปกรณ์คอมพิวเตอร์</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>อุปกรณ์คอมพิวเตอร์ในสำนักงาน</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                ตรวจสอบ เพิ่ม ลบ แก้ไข อุปกรณ์คอมพิวเตอร์ และอุปกรณ์ต่อพ่วงระบบเครือข่าย ภายในสำนักงาน
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                ไปที่หน้าจัดการคอมพิวเตอร์ <ArrowRight size={16} />
              </button>
            </motion.div>

            {/* Network Management Card */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="card glass" 
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(20, 184, 166, 0.2)' }}
              onClick={() => setView('network')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(20, 184, 166, 0.1)', padding: '1rem', borderRadius: '1rem', color: '#14b8a6' }}>
                  <Network size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">การจัดการอุปกรณ์เครือข่าย</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>อุปกรณ์เครือข่ายภายในสำนักงาน</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                ตรวจสอบ เพิ่ม ลบ แก้ไข อุปกรณ์เครือข่ายภายในสำนักงาน (Network Devices)
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                ไปที่หน้าจัดการอุปกรณ์เครือข่าย <ArrowRight size={16} />
              </button>
            </motion.div>

            {/* Budgets Management Card */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="card glass" 
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.2)' }}
              onClick={() => setView('budget_management')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-primary)' }}>
                  <Wallet size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">จัดการงบประมาณ</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Budgets Management</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                ตรวจสอบและจัดการข้อมูลรายจ่าย, งบประมาณ และรหัสบัญชีของหน่วยงาน (View, Add, Edit, Delete budgets)
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                จัดการงบประมาณ <ArrowRight size={16} />
              </button>
            </motion.div>

            {/* Job Management Card */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="card glass" 
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(245, 158, 11, 0.2)' }}
              onClick={() => setView('job_management')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                  <ClipboardList size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">จัดการงาน</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job Management</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                ตรวจสอบและจัดการงานที่ได้รับมอบหมาย, ติดตามสถานะ และรายละเอียดของงานต่างๆ
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                จัดการงาน <ArrowRight size={16} />
              </button>
            </motion.div>

            {/* Stock Management Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="card glass"
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(236, 72, 153, 0.2)' }}
              onClick={() => setView('stock_management')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '1rem', borderRadius: '1rem', color: '#ec4899' }}>
                  <Boxes size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">จัดการคลังอุปกรณ์ (Stock)</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ทะเบียนอุปกรณ์สำนักงานทั้งหมด</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                ดูรายการอุปกรณ์สำนักงานทั้งหมดในทุกสำนักงาน ค้นหาและตรวจสอบรายละเอียดอุปกรณ์แต่ละชิ้นได้
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                ไปที่หน้าจัดการคลังอุปกรณ์ <ArrowRight size={16} />
              </button>
            </motion.div>

          </motion.div>
        )}

        {view === 'network' && (
          <motion.div
            key="network"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setView('overview')}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง Overview
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Network Test History Card */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="card glass" 
                style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                onClick={() => setView('network_history')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-primary)' }}>
                    <Activity size={32} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">ประวัติการทดสอบระบบเครือข่าย</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Network Test History</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                  ตรวจสอบประวัติผลลัพธ์การทดสอบความเร็วอินเทอร์เน็ต, ค่า Latency และข้อมูลอุปกรณ์ของผู้ใช้งาน
                </p>
                <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(168, 85, 247, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  ตรวจสอบประวัติ <ArrowRight size={16} />
                </button>
              </motion.div>

              {/* Network Device Management Card */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="card glass" 
                style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                onClick={() => setView('network_devices')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}>
                    <Network size={32} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">จัดการอุปกรณ์เครือข่าย</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Network Devices</p>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                  เพิ่ม ลบ และแก้ไขข้อมูลอุปกรณ์เครือข่ายในระบบ (Add, Edit, Delete network devices)
                </p>
                <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  จัดการอุปกรณ์ <ArrowRight size={16} />
                </button>
              </motion.div>
            </div>
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
