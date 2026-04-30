import React, { useState, useEffect } from 'react';
import { Monitor, Network, ArrowRight, Activity, ArrowLeft, Loader2, RefreshCw, ChevronLeft, ChevronRight, Search, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import NetworkDeviceManagement from './NetworkDeviceManagement';
import BudgetManagement from './BudgetManagement';

const NetworkTestHistory = ({ token, onBack }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchHistory = async (isRefresh = false) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          toast.error('คุณไม่มีสิทธิ์เข้าถึงข้อมูลประวัติการทดสอบ (403 Forbidden)');
        } else {
          toast.error(errorData.message || `เกิดข้อผิดพลาดในการดึงข้อมูล (${response.status})`);
        }
        setHistory([]);
        return;
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        setHistory(data.data);
      } else if (Array.isArray(data)) {
        setHistory(data);
      } else {
        console.warn('Unexpected data format from history API:', data);
        setHistory([]);
      }
      
      if (isRefresh) {
        toast.success('อัพเดตข้อมูลประวัติการทดสอบล่าสุดสำเร็จ');
      }
    } catch (error) {
      console.error('Failed to fetch test history:', error);
      toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Filter history based on search term
  const filteredHistory = history.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    const userName = item.user 
      ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.toLowerCase() 
      : String(item.user_id || 'Guest').toLowerCase();

    return (
      (item.ip_address && String(item.ip_address).toLowerCase().includes(searchLower)) ||
      (item.computer_name && String(item.computer_name).toLowerCase().includes(searchLower)) ||
      (item.mac_address && String(item.mac_address).toLowerCase().includes(searchLower)) ||
      userName.includes(searchLower) ||
      (item.userAgent && String(item.userAgent).toLowerCase().includes(searchLower))
    );
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={onBack}
          className="glass"
          style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowLeft size={16} /> กลับ
        </button>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <option value="10" style={{ background: '#ffffff', color: '#0f172a' }}>10</option>
              <option value="25" style={{ background: '#ffffff', color: '#0f172a' }}>25</option>
              <option value="50" style={{ background: '#ffffff', color: '#0f172a' }}>50</option>
              <option value="100" style={{ background: '#ffffff', color: '#0f172a' }}>100</option>
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="ค้นหาข้อมูล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.5rem 1rem 0.5rem 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--input-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '200px'
              }}
            />
          </div>
          <button 
            onClick={() => fetchHistory(true)} 
            className="glass" 
            style={{ padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>วันที่และเวลา</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ไอพี</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่อคอมพิวเตอร์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Mac Address</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ดาวน์โหลด</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>อัพโหลด</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Latency</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผู้ทดสอบ</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ทดสอบโดย</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>Loading history...</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ไม่มีข้อมูลประวัติการทดสอบ
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleString('th-TH')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.ip_address || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.computer_name || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.mac_address || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>{item.download_speed} Mbps</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>{item.upload_speed} Mbps</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--accent-warning)' }}>{item.latency} ms</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                      {item.user ? `${item.user.first_name} ${item.user.last_name}`.trim() : (item.user_id || 'Guest')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.userAgent}>
                      {item.userAgent || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!loading && filteredHistory.length > itemsPerPage && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--glass-bg-subtle)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredHistory.length)} of {filteredHistory.length} entries
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, color: '#0f172a' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, color: '#0f172a' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Management = ({ user, token }) => {
  const [view, setView] = useState('overview');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="management-page"
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }} className="krub-bold">Management</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }} className="krub-regular">System resources and devices management</p>
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
              onClick={() => {}}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}>
                  <Monitor size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">Computer Management</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage workstation devices</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                View and manage computer assets, workstations, and endpoint configurations within the network.
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                Access Computers <ArrowRight size={16} />
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
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">Network Management</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage network infrastructure</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Configure and monitor network switches, routers, access points, and connectivity equipment.
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                Access Network <ArrowRight size={16} />
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
          <NetworkDeviceManagement token={token} onBack={() => setView('network')} user={user} />
        )}

        {view === 'budget_management' && (
          <BudgetManagement token={token} onBack={() => setView('overview')} user={user} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Management;
