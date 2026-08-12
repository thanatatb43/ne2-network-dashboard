import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, History, User, UserCog } from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// Renders whichever "who handled this" shape the API sends -- could be a
// nested user object (matching the created_by convention used elsewhere in
// this app) or just a raw *_user_id number if the loan endpoint doesn't
// populate the relation.
const StaffLabel = ({ user, id }) => {
  if (user && (user.first_name || user.username)) {
    return <>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}{user.username ? ` (@${user.username})` : ''}</>;
  }
  if (id) return <>รหัสผู้ใช้ #{id}</>;
  return <>-</>;
};

// Public, no-login history list for one piece of equipment -- shown from
// the Stock Management list only (per spec), separate from the borrow/return
// action modal.
const LoanHistoryModal = ({ equipmentId, equipmentName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLoans = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/loans`);
        const result = await res.json();
        const list = result.data || result;
        setLoans(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load loan history:', err);
        setError('ไม่สามารถโหลดประวัติการยืม-คืนได้');
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
  }, [equipmentId]);

  // Newest first, defensively supporting whichever timestamp field name the
  // API uses for when a loan was created.
  const sortedLoans = [...loans].sort((a, b) => {
    const aTime = new Date(a.borrowed_at || a.created_at || a.createdAt || 0).getTime();
    const bTime = new Date(b.borrowed_at || b.created_at || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="card glass"
        style={{ padding: '1.5rem', maxWidth: '440px', width: '100%', borderRadius: '0.75rem', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} /> ประวัติการยืม-คืน
          </h3>
          <button
            onClick={onClose}
            className="glass"
            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>
        {equipmentName && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{equipmentName}</p>
        )}

        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
          </div>
        ) : error ? (
          <p style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>{error}</p>
        ) : sortedLoans.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>ยังไม่มีประวัติการยืม-คืน</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedLoans.map((loan, i) => {
              const isOpen = !loan.returned_at;
              return (
                <div key={loan.id ?? i} className="glass" style={{ padding: '0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <User size={13} /> {loan.borrower_name || '-'}
                    </div>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700,
                      background: isOpen ? 'var(--bg-warning-subtle)' : 'var(--bg-success-subtle)',
                      color: isOpen ? 'var(--accent-warning)' : 'var(--accent-success)'
                    }}>
                      {isOpen ? 'ยืมอยู่' : 'คืนแล้ว'}
                    </span>
                  </div>
                  {(loan.borrower_emp_id || loan.borrower_contact) && (
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      {[loan.borrower_emp_id, loan.borrower_contact].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    ยืมเมื่อ: {formatDateTime(loan.borrowed_at || loan.created_at || loan.createdAt) || '-'}
                    {loan.due_date && ` · กำหนดคืน: ${formatDateTime(loan.due_date)}`}
                  </div>
                  {!isOpen && (
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                      คืนเมื่อ: {formatDateTime(loan.returned_at)}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem' }}>
                    <UserCog size={12} />
                    ดำเนินการโดย: <StaffLabel user={loan.borrowed_by || loan.staff} id={loan.borrowed_by_user_id} />
                  </div>
                  {loan.notes && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                      "{loan.notes}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LoanHistoryModal;
