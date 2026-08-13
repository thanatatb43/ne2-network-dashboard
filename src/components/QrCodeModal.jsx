import React from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';

// Shared QR modal for a single office-equipment item -- used from both the
// Stock Management list and the Computer Management detail view. updatedAt
// is appended as a cache-busting query param since the backend regenerates
// the QR image at the SAME url path whenever the record changes, and the
// browser would otherwise keep serving a stale cached PNG after an edit.
const QrCodeModal = ({ equipmentId, equipmentName, updatedAt, onClose }) => {
  const src = `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/qrcode?v=${encodeURIComponent(updatedAt || '')}`;

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
        style={{ padding: '1.5rem', maxWidth: '340px', width: '100%', borderRadius: '0.75rem', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>QR Code อุปกรณ์</h3>
          <button
            onClick={onClose}
            className="glass"
            style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <img
          src={src}
          alt={`QR Code - ${equipmentName}`}
          style={{ width: '100%', maxWidth: '260px', borderRadius: '0.5rem', background: '#fff', padding: '0.75rem' }}
        />

        <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
          {equipmentName}
        </p>

        <a
          href={src}
          download={`equipment-${equipmentId}-qrcode.png`}
          className="glass"
          style={{
            marginTop: '1.25rem', padding: '0.65rem 1.5rem', borderRadius: '0.5rem',
            background: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600,
            fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.5rem', textDecoration: 'none'
          }}
        >
          <Download size={16} /> ดาวน์โหลด
        </a>
      </motion.div>
    </motion.div>
  );
};

export default QrCodeModal;
