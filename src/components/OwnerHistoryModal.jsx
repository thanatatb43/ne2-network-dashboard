import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, UserCog, ArrowRight } from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH');
};

// A changed field on an ASSET_INFO_CHANGE entry is normally { old, new },
// but fall back to treating it as a plain value if the backend ever sends
// one without a diff (e.g. the very first value set on creation).
const ChangeLine = ({ label, change }) => {
  if (change == null) return null;
  if (typeof change === 'object') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
        <span>{change.old || '-'}</span>
        <ArrowRight size={12} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontWeight: 700 }}>{change.new || '-'}</span>
      </div>
    );
  }
  return (
    <div>
      <span style={{ color: 'var(--text-secondary)' }}>{label}: </span>
      <span style={{ fontWeight: 700 }}>{change}</span>
    </div>
  );
};

// Ownership/holder history for one piece of equipment -- pulled from the
// general audit log (GET /:id/history) and filtered down to just the
// ASSET_INFO_CHANGE entries that touch asset_owner / asset_owner_emp_id,
// since that log also mixes in unrelated UPDATE/BORROW/RETURN/CREATE noise.
const OwnerHistoryModal = ({ equipmentId, equipmentName, token, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await res.json();
        const list = result.data || result;
        const ownerChanges = (Array.isArray(list) ? list : []).filter(
          (e) => e.action === 'ASSET_INFO_CHANGE' && e.data && (e.data.asset_owner !== undefined || e.data.asset_owner_emp_id !== undefined)
        );
        setEntries(ownerChanges);
      } catch (err) {
        console.error('Failed to load owner history:', err);
        setError('ไม่สามารถโหลดประวัติผู้ถือครองได้');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [equipmentId, token]);

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
            <UserCog size={18} /> ประวัติผู้ถือครอง
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
        ) : entries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>ยังไม่มีประวัติการเปลี่ยนผู้ถือครอง</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {entries.map((entry) => (
              <div key={entry.id} className="glass" style={{ padding: '0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <ChangeLine label="ผู้ถือครอง" change={entry.data.asset_owner} />
                  <ChangeLine label="รหัสพนักงาน" change={entry.data.asset_owner_emp_id} />
                </div>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  เปลี่ยนโดย: {entry.user_name || '-'} · {formatDateTime(entry.createdAt) || '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default OwnerHistoryModal;
