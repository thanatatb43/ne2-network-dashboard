import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Loader2, ChevronLeft, ChevronRight, History, User, Package, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BorrowReturnModal from './BorrowReturnModal';

// Either the person who actually borrowed the item (matched by username
// against borrower_emp_id) OR the staff member who processed the borrow on
// their behalf (matched against borrowed_by.username) may return it
// themselves; super_admin can return on anyone's behalf (e.g. the borrower
// is unavailable or locked out).
const canReturnLoan = (user, loan) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (!user.username) return false;
  return user.username === loan.borrower_emp_id || user.username === loan.borrowed_by?.username;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
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

// Groups consecutive rows sharing the same batch_id into one card -- the API
// guarantees rows from the same batch (same borrowed_at, sorted DESC) always
// land adjacent to each other within a page, so no extra lookups are needed.
// A row without a batch_id (shouldn't normally happen, but guarded anyway)
// becomes its own single-item group.
const groupByBatch = (loans) => {
  const groups = [];
  loans.forEach((loan) => {
    const key = loan.batch_id || `single-${loan.id}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(loan);
    } else {
      groups.push({ key, items: [loan] });
    }
  });
  return groups;
};

const EquipmentLoanHistory = ({ token, user, onRequireLogin }) => {
  const [loans, setLoans] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'open' | 'returned'
  const [siteFilter, setSiteFilter] = useState('');
  const [sites, setSites] = useState([]);

  const [returnItem, setReturnItem] = useState(null); // { equipmentId, equipmentName }

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

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(itemsPerPage));
      if (statusFilter) params.append('status', statusFilter);
      if (siteFilter) params.append('pea_site_id', siteFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      // Public endpoint -- no Authorization header needed, matching the
      // existing per-equipment /:id/loans convention.
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/loans?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setLoans(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching loan history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLoans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, siteFilter, searchTerm]);

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

  const handleReturnClick = (loan) => {
    if (!user) { onRequireLogin && onRequireLogin(); return; }
    if (!canReturnLoan(user, loan)) {
      toast.error('คุณไม่มีสิทธิ์คืนอุปกรณ์นี้ เนื่องจากไม่ใช่ผู้ยืม');
      return;
    }
    setReturnItem({
      equipmentId: loan.equipment_id ?? loan.equipment?.id,
      equipmentName: loan.equipment?.name || loan.equipment_name || `อุปกรณ์ #${loan.equipment_id ?? loan.equipment?.id ?? ''}`
    });
  };

  const groups = groupByBatch(loans);

  return (
    <motion.div
      key="equipment-loans"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>ประวัติการยืม</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>รายการยืม-คืนอุปกรณ์ทั้งหมด แยกตามรอบการยืม</p>
      </div>

      <div className="card glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="ค้นหาชื่อ / รหัสพนักงาน / เบอร์ผู้ยืม..."
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
          border: statusFilter ? '1px solid var(--accent-primary)' : undefined,
          background: statusFilter ? 'var(--bg-accent-subtle)' : undefined
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
          <select value={statusFilter} onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            <option value="">ทั้งหมด</option>
            <option value="open">ยังไม่คืน</option>
            <option value="returned">คืนแล้ว</option>
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
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.total}</span> รายการ
        </div>
      </div>

      {loading ? (
        <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดประวัติการยืม...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <History size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
          <p>ไม่พบประวัติการยืม</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map((group) => {
            const first = group.items[0];
            return (
              <div key={group.key} className="card glass" style={{ padding: '1.25rem 1.5rem', borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <User size={16} /> {first.borrower_name || '-'}
                    {first.borrower_emp_id && <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>({first.borrower_emp_id})</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ยืมเมื่อ {formatDateTime(first.borrowed_at) || '-'}
                    {first.due_date && ` · กำหนดคืน ${formatDateTime(first.due_date)}`}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {group.items.map((loan) => {
                    const isOpen = !loan.returned_at;
                    const equipName = loan.equipment?.name || loan.equipment_name || `อุปกรณ์ #${loan.equipment_id ?? loan.equipment?.id ?? '-'}`;
                    return (
                      <div
                        key={loan.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                          padding: '0.6rem 0.9rem', borderRadius: '0.5rem', background: 'var(--glass-bg-subtle)', flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', minWidth: 0 }}>
                          <Package size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipName}</span>
                          {loan.equipment?.equipment_type && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({loan.equipment.equipment_type})</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontWeight: 700,
                            background: isOpen ? 'var(--bg-warning-subtle)' : 'var(--bg-success-subtle)',
                            color: isOpen ? 'var(--accent-warning)' : 'var(--accent-success)'
                          }}>
                            {isOpen ? 'ยืมอยู่' : `คืนแล้ว ${formatDateTime(loan.returned_at) || ''}`}
                          </span>
                          {isOpen && (() => {
                            // Not logged in yet: keep the button active so clicking
                            // it prompts login (handleReturnClick handles that case).
                            // Logged in but not the borrower (and not super_admin):
                            // disable it outright, no point prompting for anything.
                            const blocked = !!user && !canReturnLoan(user, loan);
                            return (
                              <button
                                onClick={() => handleReturnClick(loan)}
                                disabled={blocked}
                                title={blocked ? 'คุณไม่มีสิทธิ์คืนอุปกรณ์นี้ (ไม่ใช่ผู้ยืม)' : 'คืนอุปกรณ์'}
                                className="glass"
                                style={{
                                  padding: '0.35rem 0.75rem', borderRadius: '0.4rem', border: '1px solid rgba(168, 85, 247, 0.3)',
                                  background: 'var(--bg-accent-subtle)', color: 'var(--accent-primary)',
                                  cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.5 : 1,
                                  fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem'
                                }}
                              >
                                <Repeat size={12} /> คืน
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {first.notes && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    "{first.notes}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
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

      <AnimatePresence>
        {returnItem && (
          <BorrowReturnModal
            equipmentId={returnItem.equipmentId}
            equipmentName={returnItem.equipmentName}
            token={token}
            onClose={() => setReturnItem(null)}
            onChanged={() => { setReturnItem(null); fetchLoans(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EquipmentLoanHistory;
