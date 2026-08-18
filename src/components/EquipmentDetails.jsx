import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, AlertTriangle, Cpu, Building2, Wifi, Hash,
  Briefcase, Calendar, StickyNote, MapPin, UserCircle, PackageSearch, Pencil,
  Fingerprint, Tag, User, IdCard, Archive, Router, Repeat, ArrowLeftRight, UserCog
} from 'lucide-react';
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

const InfoRow = ({ icon: Icon, label, value, mono, blurred }) => {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 0' }}>
      <Icon size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '0.15rem' }} />
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
    <div className="card glass" style={{ padding: '0.5rem 1.25rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', padding: '0.85rem 0 0.25rem' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((child, i) => (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {child}
          </div>
        ))}
      </div>
    </div>
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

  const hasContractInfo = equipment && (equipment.vendor || equipment.contract_no || equipment.contract_start_date || equipment.contract_expiry_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}
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
          <div className="card glass" style={{ padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
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
          </div>

          {equipment.photos && equipment.photos.length > 0 && (
            <div className="card glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>รูปภาพอุปกรณ์</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {equipment.photos.map((path, i) => (
                  <a key={i} href={buildImageUrl(path, equipment.updatedAt)} target="_blank" rel="noreferrer">
                    <img
                      src={buildImageUrl(path, equipment.updatedAt)}
                      alt={`รูปอุปกรณ์ ${i + 1}`}
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}
                    />
                  </a>
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
              <div className="card glass" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
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
                <a href={buildImageUrl(equipment.storage_photo, equipment.updatedAt)} target="_blank" rel="noreferrer">
                  <img
                    src={buildImageUrl(equipment.storage_photo, equipment.updatedAt)}
                    alt="รูปสถานที่ติดตั้งหรือจัดเก็บ"
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}
                  />
                </a>
              </div>
            )}
          </Section>

          {equipment.created_by && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem 0 1.5rem' }}>
              <UserCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
              บันทึกโดย {equipment.created_by.first_name} {equipment.created_by.last_name} (@{equipment.created_by.username})
              {equipment.updatedAt && ` · แก้ไขล่าสุด ${new Date(equipment.updatedAt).toLocaleString('th-TH')}`}
            </p>
          )}

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
          </AnimatePresence>
        </>
      ) : null}
    </motion.div>
  );
};

export default EquipmentDetails;
