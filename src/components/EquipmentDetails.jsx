import './EquipmentDetails.css';
import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, Cpu, Building2, Wifi, Hash,
  Briefcase, Calendar, StickyNote, MapPin, UserCircle, PackageSearch, Pencil,
  Fingerprint, Tag, User, IdCard, Archive, Router, Repeat, ArrowLeftRight, UserCog, Wrench, X, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import BorrowReturnModal from './BorrowReturnModal';
import OwnerHistoryModal from './OwnerHistoryModal';

// Matches the status badge colors used in OfficeEquipmentManagement.jsx / DeviceDetails.jsx
const statusColorFor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

// photos/storage_photo come back from the API as relative paths (e.g.
// "/uploads/office-equipment/9-xxx.png") that need the backend's own
// origin prefixed to be viewable. Re-uploads replace the file at that SAME
// path, so the browser's HTTP cache will keep serving old cached bytes for
// that exact URL unless busted -- append updatedAt so a changed record
// always forces a fresh fetch.
const buildImageUrl = (path, cacheBust) => {
  if (!path) return null;
  const base = `${import.meta.env.VITE_API_BASE_URL}${path}`;
  return cacheBust ? `${base}?v=${encodeURIComponent(cacheBust)}` : base;
};

// due_date is a full timestamp (date + time), so it's shown with both.
const formatDueDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

// Same status-color convention as JobManagement.jsx/JobReport.jsx's
// jobStatusColor -- kept local since this file has no other reason to
// import those components' internals.
const jobStatusColorFor = (status) => {
  const s = (status || '').trim();
  if (s === 'เปิดงาน') return 'var(--text-secondary)';
  if (s === 'ระหว่างดำเนินการ') return 'var(--accent-warning)';
  if (s === 'เสร็จงาน') return 'var(--accent-success)';
  if (s === 'ยกเลิก') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

const JobStatusBadge = ({ status }) => (
  <span style={{
    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '1rem',
    fontSize: '0.7rem', fontWeight: 700,
    color: jobStatusColorFor(status), background: `${jobStatusColorFor(status)}15`
  }}>
    {status || '-'}
  </span>
);

// Shared row shape for both problem_jobs ("อุปกรณ์นี้ถูกแจ้งว่ามีปัญหาในงานนี้"
// -- the actual repair history) and jobs ("อุปกรณ์นี้ถูกนำไปใช้ดำเนินการในงานนี้"
// -- used as a tool/part for some other job's repair), from the new
// GET /api/office-equipment/:id (and /, /site/:id) response fields.
const JobHistoryList = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
    {items.map(job => (
      <div key={job.id} className="glass" style={{ padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-word' }}>{job.job_name || '-'}</span>
          <JobStatusBadge status={job.status} />
        </div>
        {job.job_type && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{job.job_type}</div>
        )}
        {job.closing_notes && (
          <div style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>{job.closing_notes}</div>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
          {job.createdAt ? new Date(job.createdAt).toLocaleDateString('th-TH') : '-'}
          {job.updatedAt && job.updatedAt !== job.createdAt && ` · อัปเดตล่าสุด ${new Date(job.updatedAt).toLocaleDateString('th-TH')}`}
        </div>
      </div>
    ))}
  </div>
);

// In-page photo viewer -- replaces plain <a target="_blank"> thumbnails so
// browsing pictures doesn't leave the equipment page. Works for both the
// multi-photo gallery (with prev/next + arrow-key navigation) and the
// single storage photo (images.length === 1, arrows just don't render).
const ImageLightbox = ({ images, index, onClose, onNavigate }) => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && images.length > 1) onNavigate((index - 1 + images.length) % images.length);
      else if (e.key === 'ArrowRight' && images.length > 1) onNavigate((index + 1) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, images.length, onClose, onNavigate]);

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem'
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)',
          border: 'none', color: '#fff', borderRadius: '50%', width: '2.5rem', height: '2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index - 1 + images.length) % images.length); }}
          style={{
            position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%',
            width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <img
        src={images[index]}
        alt={`รูปที่ ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '0.5rem' }}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index + 1) % images.length); }}
          style={{
            position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%',
            width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem',
          padding: '0.3rem 0.8rem', borderRadius: '1rem'
        }}>
          {index + 1} / {images.length}
        </div>
      )}
    </Motion.div>
  );
};

const InfoRow = ({ icon: Icon, label, value, mono, blurred }) => {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 0' }}>
      {React.createElement(Icon, { size: 18, style: { color: 'var(--text-secondary)', flexShrink: 0, marginTop: '0.15rem' } })}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          wordBreak: 'break-word',
          fontFamily: mono ? 'ui-monospace' : 'inherit',
          filter: blurred ? 'blur(4px)' : 'none',
          userSelect: blurred ? 'none' : 'auto',
          transition: 'filter 0.3s ease'
        }}>{value}</div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <section className="glass equipment-details-section">
      <h2 className="equipment-details-section-title">{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((child, i) => (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {child}
          </div>
        ))}
      </div>
    </section>
  );
};

const EquipmentDetails = ({ equipmentId, onBack, user, token, onEditClick, onRequireLogin }) => {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openLoan, setOpenLoan] = useState(null);
  const [loadingLoan, setLoadingLoan] = useState(true);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showOwnerHistory, setShowOwnerHistory] = useState(false);
  // Which gallery is open in the lightbox -- 'photos' | 'storage' | null --
  // plus the index within that gallery's image list.
  const [lightboxGallery, setLightboxGallery] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchEquipment = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}`);
      const result = await response.json();
      if (result.success) {
        setEquipment(result.data);
      } else {
        setError('ไม่พบข้อมูลอุปกรณ์นี้');
        setEquipment(null);
      }
    } catch (err) {
      console.error('Failed to fetch equipment details:', err);
      setError('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้ กรุณาลองใหม่อีกครั้ง');
      setEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanStatus = async () => {
    setLoadingLoan(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/loans`);
      const result = await res.json();
      const loans = result.data || result;
      const open = Array.isArray(loans) ? loans.find(l => !l.returned_at) : null;
      setOpenLoan(open || null);
    } catch (err) {
      console.error('Failed to fetch loan status:', err);
    } finally {
      setLoadingLoan(false);
    }
  };

  useEffect(() => {
    if (!equipmentId) return;
    fetchEquipment();
    fetchLoanStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  // Opens a one-sticker print window; printing waits for the QR image to
  // finish loading so a slow response can't print a blank box.
  const printQr = () => {
    const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const src = `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipment.id}/qrcode?v=${encodeURIComponent(equipment.updatedAt || '')}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>พิมพ์ QR Code อุปกรณ์ ${escapeHtml(equipment.id)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; }
  .qr-cell { display: inline-flex; flex-direction: column; align-items: center; border: 1px dashed #999; border-radius: 4mm; padding: 6mm; max-width: 80mm; }
  .qr-cell img { width: 60mm; height: 60mm; object-fit: contain; }
  .qr-cell .caption { margin-top: 4mm; font-size: 11pt; color: #333; text-align: center; word-break: break-word; }
</style>
</head>
<body>
  <div class="qr-cell">
    <img id="qr" src="${escapeHtml(src)}" alt="QR ${escapeHtml(equipment.id)}" />
    <div class="caption">ID: ${escapeHtml(equipment.id)}</div>
    <div class="caption">${escapeHtml(equipment.name)}</div>
  </div>
  <script>
    var img = document.getElementById('qr');
    function go() { setTimeout(function() { window.print(); }, 200); }
    if (img.complete) go(); else { img.onload = go; img.onerror = function() { document.body.insertAdjacentHTML('beforeend', '<p>โหลด QR Code ไม่สำเร็จ</p>'); }; }
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const hasContractInfo = equipment && (equipment.vendor || equipment.contract_no || equipment.contract_start_date || equipment.contract_expiry_date);

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="equipment-details-page"
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: '0.9rem', cursor: 'pointer', padding: '0.5rem 0', marginBottom: '0.5rem'
        }}
      >
        <ChevronLeft size={18} /> ย้อนกลับ
      </button>

      {loading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูลอุปกรณ์...</p>
        </div>
      ) : error ? (
        <div className="card glass" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <AlertTriangle size={40} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : equipment ? (
        <>
          {/* Hero */}
          <header className="glass equipment-details-hero">
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '50%',
              background: 'var(--bg-accent-subtle)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <PackageSearch size={26} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, wordBreak: 'break-word' }}>{equipment.name || '-'}</h1>
            <span style={{
              display: 'inline-block', marginTop: '0.6rem', padding: '0.25rem 0.75rem', borderRadius: '1rem',
              fontSize: '0.8rem', fontWeight: 700,
              color: statusColorFor(equipment.status),
              background: `${statusColorFor(equipment.status)}15`
            }}>
              {equipment.status || '-'}
            </span>
            {openLoan && (
              <div style={{
                marginTop: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: '0.5rem',
                background: 'var(--bg-warning-subtle)', color: 'var(--accent-warning)',
                fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
              }}>
                <ArrowLeftRight size={14} />
                กำลังถูกยืมโดย <strong>{openLoan.borrower_name || '-'}</strong>
                {openLoan.due_date && <>· กำหนดคืน {formatDueDate(openLoan.due_date)}</>}
              </div>
            )}
          </header>

          <div className="equipment-details-actions" aria-label="จัดการอุปกรณ์">
          <button
            onClick={() => {
              if (!user) { onRequireLogin && onRequireLogin(); return; }
              setShowBorrowModal(true);
            }}
            disabled={loadingLoan}
            className="glass"
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: openLoan ? 'var(--accent-warning)' : 'var(--bg-accent-subtle)',
              color: openLoan ? '#fff' : 'var(--accent-primary)',
              border: openLoan ? 'none' : '1px solid var(--accent-primary)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: loadingLoan ? 'not-allowed' : 'pointer',
              opacity: loadingLoan ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              marginBottom: '0.75rem'
            }}
          >
            {loadingLoan ? <Loader2 size={18} className="animate-spin" /> : openLoan ? <ArrowLeftRight size={18} /> : <Repeat size={18} />}
            {loadingLoan ? 'กำลังตรวจสอบสถานะยืม...' : openLoan ? 'คืนอุปกรณ์' : 'ยืมอุปกรณ์'}
          </button>

          <button
            onClick={() => setShowOwnerHistory(true)}
            className="glass"
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'var(--bg-accent-subtle)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              marginBottom: '0.75rem'
            }}
          >
            <UserCog size={18} /> ดูประวัติผู้ถือครอง
          </button>

          <button
            onClick={printQr}
            className="glass"
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'var(--bg-accent-subtle)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              marginBottom: '0.75rem'
            }}
          >
            <Printer size={18} /> พิมพ์ QR Code
          </button>

          <button
            onClick={() => onEditClick && onEditClick(equipment)}
            className="glass"
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              marginBottom: '1.5rem'
            }}
          >
            <Pencil size={18} /> แก้ไขข้อมูลอุปกรณ์
          </button>

          </div>

          <div className="equipment-details-grid">
          {equipment.photos && equipment.photos.length > 0 && (
            <div className="glass equipment-details-section equipment-details-wide">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>รูปภาพอุปกรณ์</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {equipment.photos.map((path, i) => (
                  <img
                    key={i}
                    src={buildImageUrl(path, equipment.updatedAt)}
                    alt={`รูปอุปกรณ์ ${i + 1}`}
                    onClick={() => { setLightboxGallery('photos'); setLightboxIndex(i); }}
                    className="equipment-details-photo" role="button" tabIndex={0}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setLightboxGallery('photos'); setLightboxIndex(i); } }}
                  />
                ))}
              </div>
            </div>
          )}

          <Section title="ข้อมูลทั่วไป">
            <InfoRow icon={Cpu} label="ประเภทอุปกรณ์" value={equipment.equipment_type} />
            <InfoRow icon={Building2} label="แผนก" value={equipment.department} />
          </Section>

          <Section title="เครือข่าย">
            <InfoRow icon={Wifi} label="IP Address" value={equipment.ip_address} mono blurred={!user} />
            <InfoRow icon={Hash} label="MAC Address" value={equipment.mac_address} mono blurred={!user} />
          </Section>

          <Section title="ครุภัณฑ์">
            <InfoRow icon={Fingerprint} label="Serial Number" value={equipment.serial_number} mono />
            <InfoRow icon={Tag} label="รหัสทรัพย์สิน" value={equipment.asset_number} />
            <InfoRow icon={User} label="ผู้ถือครอง" value={equipment.asset_owner} />
            <InfoRow icon={IdCard} label="รหัสพนักงานผู้ถือครอง" value={equipment.asset_owner_emp_id} />
          </Section>

          {hasContractInfo && (
            <Section title="ข้อมูลผู้ขาย/สัญญา">
              <InfoRow icon={Briefcase} label="ผู้ขาย" value={equipment.vendor} />
              <InfoRow icon={Hash} label="เลขที่สัญญา" value={equipment.contract_no} />
              <InfoRow icon={Calendar} label="วันเริ่มสัญญา" value={equipment.contract_start_date} />
              <InfoRow icon={Calendar} label="วันหมดอายุสัญญา" value={equipment.contract_expiry_date} />
            </Section>
          )}

          <Section title="หมายเหตุ">
            <InfoRow icon={StickyNote} label="หมายเหตุ" value={equipment.notes} />
          </Section>

          <Section title="สำนักงาน">
            <InfoRow
              icon={MapPin}
              label="สำนักงาน"
              value={equipment.pea_site ? `${equipment.pea_site.pea_name}${equipment.pea_site.pea_province ? ` (${equipment.pea_site.pea_province})` : ''}` : null}
            />
          </Section>

          {equipment.network_ip && (() => {
            const ranges = [
              { label: 'วงหลัก', ip: equipment.network_ip.main },
              { label: '172.x (สำรอง)', ip: equipment.network_ip.secondary_172 },
              { label: '10.221.x', ip: equipment.network_ip.secondary_10 },
              { label: 'DHCP Range', ip: equipment.network_ip.dhcp_range }
            ].filter(item => item.ip && item.ip !== '-');
            if (ranges.length === 0) return null;
            return (
              <div className="glass equipment-details-section equipment-details-wide">
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Router size={15} /> วง IP ของสำนักงาน
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {ranges.map(item => (
                    <div
                      key={item.label}
                      className="glass"
                      style={{ padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}:</span>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)',
                        filter: !user ? 'blur(4px)' : 'none', userSelect: !user ? 'none' : 'auto'
                      }}>{item.ip}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <Section title="ที่ติดตั้งหรือจัดเก็บ">
            <InfoRow icon={Archive} label="สถานที่ติดตั้งหรือจัดเก็บ" value={equipment.storage_location} />
            {equipment.storage_photo && (
              <div style={{ padding: '0.85rem 0' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>รูปสถานที่ติดตั้งหรือจัดเก็บ</div>
                <img
                  src={buildImageUrl(equipment.storage_photo, equipment.updatedAt)}
                  alt="รูปสถานที่ติดตั้งหรือจัดเก็บ"
                  onClick={() => { setLightboxGallery('storage'); setLightboxIndex(0); }}
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                />
              </div>
            )}
          </Section>

          {equipment.problem_jobs && equipment.problem_jobs.length > 0 && (
            <div className="glass equipment-details-section equipment-details-wide">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wrench size={15} /> ประวัติการแจ้งปัญหา/ซ่อม
              </div>
              <JobHistoryList items={equipment.problem_jobs} />
            </div>
          )}

          {equipment.jobs && equipment.jobs.length > 0 && (
            <div className="glass equipment-details-section equipment-details-wide">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Briefcase size={15} /> งานที่นำอุปกรณ์นี้ไปใช้ดำเนินการ
              </div>
              <JobHistoryList items={equipment.jobs} />
            </div>
          )}

          {equipment.created_by && (
            <p className="equipment-details-wide" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
              <UserCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
              บันทึกโดย {equipment.created_by.first_name} {equipment.created_by.last_name} (@{equipment.created_by.username})
              {equipment.updatedAt && ` · แก้ไขล่าสุด ${new Date(equipment.updatedAt).toLocaleString('th-TH')}`}
            </p>
          )}

          </div>

          <AnimatePresence>
            {showBorrowModal && (
              <BorrowReturnModal
                equipmentId={equipmentId}
                equipmentName={equipment.name}
                token={token}
                onClose={() => setShowBorrowModal(false)}
                onChanged={() => {
                  setShowBorrowModal(false);
                  fetchEquipment();
                  fetchLoanStatus();
                }}
              />
            )}
            {showOwnerHistory && (
              <OwnerHistoryModal
                equipmentId={equipmentId}
                equipmentName={equipment.name}
                token={token}
                onClose={() => setShowOwnerHistory(false)}
              />
            )}
            {lightboxGallery && (
              <ImageLightbox
                images={
                  lightboxGallery === 'photos'
                    ? equipment.photos.map(p => buildImageUrl(p, equipment.updatedAt))
                    : [buildImageUrl(equipment.storage_photo, equipment.updatedAt)]
                }
                index={lightboxIndex}
                onNavigate={setLightboxIndex}
                onClose={() => setLightboxGallery(null)}
              />
            )}
          </AnimatePresence>
        </>
      ) : null}
    </Motion.div>
  );
};

export default EquipmentDetails;
