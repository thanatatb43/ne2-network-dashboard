import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Search, Loader2, ChevronLeft, ChevronRight, ShoppingCart, X, Plus, Check,
  CheckCircle2, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Same fixed option lists OfficeEquipmentManagement.jsx's create/edit form
// uses, duplicated here since they aren't exported from that file.
const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];
const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];
// "ถูกยืม" isn't one of the record's own lifecycle statuses -- it's what the
// API reports when an item currently has an open loan -- but it's still a
// valid filter value, so it's listed separately from the fixed lifecycle list.
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย', 'ถูกยืม'];

// photos come back from the API as relative paths (e.g.
// "/uploads/office-equipment/9-xxx.png") that need the backend's own origin
// prefixed to be viewable -- same convention as EquipmentDetails.jsx.
const buildImageUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;

const statusColor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  if (s === 'ถูกยืม') return '#a855f7';
  return 'var(--text-secondary)';
};

// due_date is a full timestamp; <input type="datetime-local"> gives back a
// naive "YYYY-MM-DDTHH:mm" string with no timezone, so it's treated
// explicitly as Thailand local time (+07:00) to match what the backend
// expects -- same convention BorrowReturnModal.jsx already uses.
const toBangkokIso = (datetimeLocalValue) => {
  if (!datetimeLocalValue) return '';
  return `${datetimeLocalValue}:00+07:00`;
};

const inputStyle = {
  padding: '0.6rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none'
};

const EquipmentBorrow = ({ token, user, onRequireLogin }) => {
  const [equipment, setEquipment] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [department, setDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [sites, setSites] = useState([]);

  const [cart, setCart] = useState([]); // array of equipment objects
  const [showCart, setShowCart] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmpId, setBorrowerEmpId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseModal, setResponseModal] = useState(null); // { type: 'success' | 'error', message: string }

  const fetchSites = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      const list = result.data || result || [];
      setSites(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites:', error);
    }
  };

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (equipmentType) params.append('equipment_type', equipmentType);
      if (department) params.append('department', department);
      if (statusFilter) params.append('status', statusFilter);
      if (siteFilter) params.append('pea_site_id', siteFilter);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) {
        setEquipment(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching office equipment:', error);
      toast.error('ไม่สามารถโหลดรายการอุปกรณ์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage, searchTerm, equipmentType, department, statusFilter, siteFilter]);

  // Debounces free-text search into a single request; lands together with
  // the page-1 reset so they batch into one re-render instead of racing
  // across two separate effects.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  const isBorrowed = (item) => item.status === 'ถูกยืม' || !!item.current_loan;
  const isInCart = (item) => cart.some(c => c.id === item.id);

  const toggleCart = (item) => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    if (isBorrowed(item)) return;
    setCart(prev => isInCart(item) ? prev.filter(c => c.id !== item.id) : [...prev, item]);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));

  const openCart = () => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    setShowCart(true);
  };

  const handleBorrowClick = () => {
    if (cart.length === 0) return;
    if (!borrowerName.trim()) {
      toast.error('กรุณากรอกชื่อผู้ยืม');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmBorrow = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/borrow-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipment_ids: cart.map(c => c.id),
          borrower_name: borrowerName.trim(),
          borrower_emp_id: borrowerEmpId.trim(),
          due_date: toBangkokIso(dueDate)
        })
      });
      const result = await response.json();
      if (response.ok) {
        setResponseModal({ type: 'success', message: result.message || `ยืมอุปกรณ์สำเร็จ ${cart.length} รายการ` });
        setCart([]);
        setBorrowerName('');
        setBorrowerEmpId('');
        setDueDate('');
        setShowConfirm(false);
        setShowCart(false);
        fetchEquipment();
      } else {
        setResponseModal({ type: 'error', message: result.message || result.error || 'ยืมอุปกรณ์ไม่สำเร็จ' });
      }
    } catch (error) {
      console.error('Error submitting borrow batch:', error);
      setResponseModal({ type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      key="equipment-borrow"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>ยืมอุปกรณ์</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>เลือกอุปกรณ์ที่ต้องการยืมลงตระกร้า แล้วยืนยันการยืมพร้อมกันได้หลายชิ้น</p>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ / รหัสทรัพย์สิน / Serial / IP / MAC..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                ...inputStyle, width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem',
                border: searchInput ? '1px solid var(--accent-primary)' : inputStyle.border,
                background: searchInput ? 'var(--bg-accent-subtle)' : inputStyle.background
              }}
            />
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: equipmentType ? '1px solid var(--accent-primary)' : undefined,
            background: equipmentType ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
            <select value={equipmentType} onChange={(e) => handleFilterChange(setEquipmentType)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {EQUIPMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: department ? '1px solid var(--accent-primary)' : undefined,
            background: department ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>แผนก:</span>
            <select value={department} onChange={(e) => handleFilterChange(setDepartment)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: statusFilter ? '1px solid var(--accent-primary)' : undefined,
            background: statusFilter ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
            <select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: siteFilter ? '1px solid var(--accent-primary)' : undefined,
            background: siteFilter ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สำนักงาน:</span>
            <select value={siteFilter} onChange={(e) => handleFilterChange(setSiteFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              <option value="">ทั้งหมด</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.pea_name}{s.province ? ` (${s.province})` : ''}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            แสดง <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{equipment.length}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.total}</span> รายการ
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่ออุปกรณ์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภท</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>แผนก</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สำนักงาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สถานะ</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังโหลดรายการอุปกรณ์...</p>
                  </td>
                </tr>
              ) : equipment.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                equipment.map(item => {
                  const borrowed = isBorrowed(item);
                  const inCart = isInCart(item);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {item.photos?.[0] && (
                            <img
                              src={buildImageUrl(item.photos[0])}
                              alt=""
                              style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.4rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
                            />
                          )}
                          <span>{item.name || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.equipment_type || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.department || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                        {item.pea_site ? `${item.pea_site.pea_name}${item.pea_site.pea_province ? ` (${item.pea_site.pea_province})` : ''}` : '-'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                          fontSize: '0.75rem', fontWeight: 600,
                          color: statusColor(item.status), background: `${statusColor(item.status)}15`
                        }}>
                          {item.status || '-'}
                        </span>
                        {borrowed && item.current_loan?.borrower_name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            โดย {item.current_loan.borrower_name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        {borrowed ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ถูกยืมอยู่</span>
                        ) : (
                          <button
                            onClick={() => toggleCart(item)}
                            className="glass"
                            style={{
                              padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: 'none',
                              background: inCart ? 'var(--bg-accent-subtle)' : 'var(--accent-primary)',
                              color: inCart ? 'var(--accent-primary)' : '#fff',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              fontSize: '0.8rem', fontWeight: 600
                            }}
                          >
                            {inCart ? <><Check size={14} /> อยู่ในตระกร้า</> : <><Plus size={14} /> เพิ่มลงตระกร้า</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              หน้า <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.totalPages}</span>
            </span>
            <button
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === pagination.totalPages ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Floating cart button */}
      <button
        onClick={openCart}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 900,
          width: '3.5rem', height: '3.5rem', borderRadius: '50%', border: 'none',
          background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}
        title="ตระกร้ายืมอุปกรณ์"
      >
        <ShoppingCart size={22} />
        {cart.length > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', minWidth: '1.4rem', height: '1.4rem',
            borderRadius: '1rem', background: 'var(--accent-danger)', color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 0.3rem'
          }}>
            {cart.length}
          </span>
        )}
      </button>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 9998 }}
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ width: '100%', maxWidth: '420px', height: '100%', overflowY: 'auto', padding: '1.5rem', borderRadius: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={18} /> ตระกร้ายืมอุปกรณ์ ({cart.length})
                </h3>
                <button onClick={() => setShowCart(false)} className="glass" style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              {cart.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>ยังไม่มีอุปกรณ์ในตระกร้า</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {cart.map(item => (
                      <div key={item.id} className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          {item.photos?.[0] && (
                            <img
                              src={buildImageUrl(item.photos[0])}
                              alt=""
                              style={{ width: '2rem', height: '2rem', borderRadius: '0.4rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
                            />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '-'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.equipment_type || '-'}</div>
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ชื่อผู้ยืม <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
                      <input type="text" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} style={inputStyle} placeholder="ชื่อ-นามสกุลผู้ยืม" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>รหัสพนักงานผู้ยืม</label>
                      <input type="text" value={borrowerEmpId} onChange={(e) => setBorrowerEmpId(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>กำหนดคืน (วันและเวลา)</label>
                      <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
                    </div>

                    <button
                      onClick={handleBorrowClick}
                      style={{
                        marginTop: '0.5rem', padding: '0.85rem', borderRadius: '0.5rem', border: 'none',
                        background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                      }}
                    >
                      <ShoppingCart size={16} /> ยืมอุปกรณ์ {cart.length} รายการ
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm borrow modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}
            onClick={() => !submitting && setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-accent-subtle)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <ShoppingCart size={24} />
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>ยืนยันการยืมอุปกรณ์</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                ยืมอุปกรณ์ <strong style={{ color: 'var(--text-primary)' }}>{cart.length} รายการ</strong> ให้<br />
                <strong style={{ color: 'var(--text-primary)' }}>{borrowerName}</strong>{borrowerEmpId ? ` (${borrowerEmpId})` : ''} ใช่หรือไม่?
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                  className="glass"
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmBorrow}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none',
                    background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  ยืนยัน
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response modal */}
      <AnimatePresence>
        {responseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
            onClick={() => setResponseModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2.5rem', maxWidth: '420px', width: '90%', textAlign: 'center' }}
            >
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: responseModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: responseModal.type === 'success' ? '#10b981' : '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                {responseModal.type === 'success' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>{responseModal.type === 'success' ? 'สำเร็จ' : 'เกิดข้อผิดพลาด'}</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.5, fontSize: '0.9rem' }}>{responseModal.message}</p>
              <button
                onClick={() => setResponseModal(null)}
                style={{ padding: '0.75rem 2rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                ตกลง
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EquipmentBorrow;
