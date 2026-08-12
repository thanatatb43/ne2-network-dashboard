import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, Loader2, AlertTriangle, Save, ShieldAlert, ImagePlus, Upload, ImageOff, X, Trash2 } from 'lucide-react';

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
// Fed to <input accept>. MIME types alone are unreliable for filtering the
// native file picker on some Windows setups (a .jpg with no/odd file
// association can report file.type as '' or something unexpected), so
// extensions are included too as a fallback the OS can always match on.
const FILE_INPUT_ACCEPT = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_IMAGE_EXTENSIONS].join(',');

// Storage-photo re-uploads replace the file at the SAME path (the backend
// deletes the old one and writes the new one under the same name), so the
// browser's HTTP cache will happily keep serving the old cached bytes for
// that exact URL unless we bust it -- append a value that changes whenever
// the record is updated (its updatedAt timestamp) to force a real refetch.
const buildImageUrl = (path, cacheBust) => {
  if (!path) return null;
  const base = `${import.meta.env.VITE_API_BASE_URL}${path}`;
  return cacheBust ? `${base}?v=${encodeURIComponent(cacheBust)}` : base;
};

// Rejects the whole selection with a Thai error message if any file fails
// type/size checks -- mirrors the backend's own validation so bad files get
// caught before wasting an upload round-trip. Accepts a file if EITHER the
// browser-reported MIME type OR the filename extension looks like an image --
// file.type isn't always trustworthy (some Windows setups report '' or an
// unexpected value for otherwise-normal .jpg files), so the extension is
// used as a fallback rather than requiring both to agree.
const validateImageFiles = (files) => {
  for (const file of files) {
    const hasValidType = ALLOWED_IMAGE_TYPES.includes(file.type);
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidType && !hasValidExtension) {
      return `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (jpeg/png/webp/gif)`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `ไฟล์ "${file.name}" มีขนาดเกิน 5MB`;
    }
  }
  return null;
};

// Both fields are optional, but the backend validates strictly if a value
// IS present (ip_address must be a real IPv4 address; mac_address must be
// exactly AA:BB:CC:DD:EE:FF, uppercase). Since the save is a single
// all-or-nothing request, one malformed field here would silently reject
// the WHOLE update -- including unrelated fields that were entered
// correctly -- so these are checked client-side before submitting, with a
// clear message pointing at the actual field instead of a generic failure.
const isValidIpAddress = (ip) => {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return ip.split('.').every(part => Number(part) <= 255);
};
const isValidMacAddress = (mac) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);

const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];
const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย', 'active', 'จัดเก็บ', 'อื่นๆ'];

const GENERAL_FIELDS = [
  { name: 'name', label: 'ชื่ออุปกรณ์', type: 'text', required: true },
  { name: 'equipment_type', label: 'ประเภทอุปกรณ์', type: 'combo', options: EQUIPMENT_TYPE_OPTIONS },
  { name: 'department', label: 'แผนก', type: 'combo', options: DEPARTMENT_OPTIONS },
  { name: 'status', label: 'สถานะ', type: 'combo', options: STATUS_OPTIONS }
];
const NETWORK_FIELDS = [
  { name: 'ip_address', label: 'IP Address', type: 'text' },
  { name: 'mac_address', label: 'MAC Address', type: 'text' }
];
const ASSET_FIELDS = [
  { name: 'serial_number', label: 'Serial Number', type: 'text' },
  { name: 'asset_number', label: 'เลขครุภัณฑ์', type: 'text' },
  { name: 'asset_owner', label: 'ผู้ถือครอง', type: 'text' },
  { name: 'asset_owner_emp_id', label: 'รหัสพนักงานผู้ถือครอง', type: 'text' }
];
const STORAGE_FIELDS = [
  { name: 'storage_location', label: 'สถานที่จัดเก็บ', type: 'text' }
];
const VENDOR_FIELDS = [
  { name: 'vendor', label: 'ผู้ขาย (Vendor)', type: 'text' },
  { name: 'contract_no', label: 'เลขที่สัญญา', type: 'text' },
  { name: 'contract_start_date', label: 'วันเริ่มสัญญา', type: 'date' },
  { name: 'contract_expiry_date', label: 'วันหมดอายุสัญญา', type: 'date' }
];
const NOTES_FIELDS = [
  { name: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'รายละเอียด ที่ตั้ง หรือข้อมูลอื่นๆ' }
];

const ALL_FIELD_NAMES = [
  ...GENERAL_FIELDS, ...NETWORK_FIELDS, ...ASSET_FIELDS, ...STORAGE_FIELDS, ...VENDOR_FIELDS, ...NOTES_FIELDS
].map(f => f.name).concat('pea_site_id');

const fieldInputStyle = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  outline: 'none'
};

const FormField = ({ field, value, onChange, disabled, disabledHint }) => {
  const disabledStyle = disabled ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--glass-bg-subtle)' } : {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.75rem 0' }}>
      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {field.label}{field.required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
      </label>
      {field.type === 'select' ? (
        <select name={field.name} value={value || ''} onChange={onChange} disabled={disabled} style={{ ...fieldInputStyle, ...disabledStyle }}>
          <option value="">-- ไม่ระบุ --</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'combo' ? (
        <>
          <input
            type="text"
            list={`${field.name}-options`}
            name={field.name}
            value={value || ''}
            onChange={onChange}
            disabled={disabled}
            placeholder="เลือกจากรายการ หรือพิมพ์เอง..."
            style={{ ...fieldInputStyle, ...disabledStyle }}
          />
          <datalist id={`${field.name}-options`}>
            {field.options.map(opt => <option key={opt} value={opt} />)}
          </datalist>
        </>
      ) : field.type === 'textarea' ? (
        <textarea
          name={field.name}
          value={value || ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={3}
          style={{ ...fieldInputStyle, ...disabledStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      ) : (
        <input
          type={field.type}
          name={field.name}
          value={value || ''}
          onChange={onChange}
          disabled={disabled}
          placeholder={field.placeholder}
          required={field.required}
          style={{ ...fieldInputStyle, ...disabledStyle }}
        />
      )}
      {disabled && disabledHint && (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--accent-warning)' }}>{disabledHint}</p>
      )}
    </div>
  );
};

const FormSection = ({ title, children }) => (
  <div className="card glass" style={{ padding: '0.5rem 1.25rem', marginBottom: '1rem' }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', padding: '0.85rem 0 0.25rem' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
  </div>
);

const EquipmentEdit = ({ equipmentId, token, user, onBack, onSaved, onCreated, defaultSiteId }) => {
  const isNew = equipmentId === 'new';
  const canEdit = ['super_admin', 'computer_admin', 'network_admin', 'operator'].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [sites, setSites] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingStoragePhoto, setUploadingStoragePhoto] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [openLoan, setOpenLoan] = useState(null);
  // Set right after a successful create so the load effect below (which
  // re-runs because equipmentId just flipped from 'new' to a real id) skips
  // its usual refetch for that one transition. formData already holds
  // exactly what was just submitted and confirmed saved; re-reading
  // immediately risks a read-after-write race with the backend showing a
  // stale/incomplete row, which would silently wipe out what was just typed.
  const justCreatedIdRef = useRef(null);

  // Re-fetches just the equipment record (not the site list) -- used on
  // mount and again after a photo upload, since photos/storage_photo are
  // returned by this same endpoint but written via separate upload
  // endpoints, so the local formData needs to be refreshed to pick them up.
  const refetchEquipment = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.success) {
      setFormData(result.data);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!equipmentId || !canEdit) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        if (isNew) {
          // No record to load yet -- just seed the site if the caller
          // knows which storage-location tab the user came from.
          setFormData(defaultSiteId ? { pea_site_id: String(defaultSiteId) } : {});
          setOpenLoan(null);
        } else {
          if (String(justCreatedIdRef.current) === String(equipmentId)) {
            justCreatedIdRef.current = null;
          } else {
            const equipOk = await refetchEquipment();
            if (!equipOk) setError('ไม่พบข้อมูลอุปกรณ์นี้');
          }

          // Editing the status field is blocked while the equipment is on
          // an open loan -- it has to be returned first.
          try {
            const loanRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/loans`);
            const loanResult = await loanRes.json();
            const loans = loanResult.data || loanResult;
            const open = Array.isArray(loans) ? loans.find(l => !l.returned_at) : null;
            setOpenLoan(open || null);
          } catch (loanErr) {
            console.error('Failed to check loan status:', loanErr);
          }
        }

        const sitesRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const sitesResult = await sitesRes.json();
        const sitesList = sitesResult.data || sitesResult;
        setSites(Array.isArray(sitesList) ? sitesList : []);
      } catch (err) {
        console.error('Failed to load equipment for editing:', err);
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId, token, canEdit]);

  const handlePhotosChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const existingCount = (formData.photos || []).length;
    if (existingCount + files.length > MAX_PHOTOS) {
      toast.error(`อัปโหลดรูปได้สูงสุด ${MAX_PHOTOS} รูป (ตอนนี้มีอยู่แล้ว ${existingCount} รูป)`);
      e.target.value = '';
      return;
    }
    const validationError = validateImageFiles(files);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }

    setUploadingPhotos(true);
    try {
      const body = new FormData();
      files.forEach(file => body.append('photos', file));
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'อัปโหลดรูปภาพสำเร็จ');
      } else {
        toast.error(result.message || result.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Failed to upload photos:', err);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      // Reset the spinner as soon as the upload itself is done -- the
      // refresh below is a separate best-effort step and must not leave the
      // button stuck spinning if it's slow to come back.
      setUploadingPhotos(false);
      e.target.value = '';
    }

    try {
      await refetchEquipment();
    } catch (err) {
      console.error('Failed to refresh equipment after photo upload:', err);
    }
  };

  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return;

    setDeletingPhoto(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/photos`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photo_path: photoToDelete })
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'ลบรูปภาพสำเร็จ');
      } else {
        toast.error(result.message || result.error || 'ลบรูปภาพไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
      toast.error('เกิดข้อผิดพลาดในการลบรูปภาพ');
    } finally {
      setDeletingPhoto(false);
      setPhotoToDelete(null);
    }

    try {
      await refetchEquipment();
    } catch (err) {
      console.error('Failed to refresh equipment after photo delete:', err);
    }
  };

  const handleStoragePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFiles([file]);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }

    setUploadingStoragePhoto(true);
    try {
      const body = new FormData();
      body.append('storage_photo', file);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/storage-photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'อัปโหลดรูปสถานที่จัดเก็บสำเร็จ');
      } else {
        toast.error(result.message || result.error || 'อัปโหลดรูปไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Failed to upload storage photo:', err);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูป');
    } finally {
      setUploadingStoragePhoto(false);
      e.target.value = '';
    }

    try {
      await refetchEquipment();
    } catch (err) {
      console.error('Failed to refresh equipment after storage photo upload:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;

    const ipValue = (formData.ip_address || '').trim();
    if (ipValue && !isValidIpAddress(ipValue)) {
      toast.error('IP Address ไม่ถูกต้อง กรุณากรอกรูปแบบ เช่น 172.21.5.10');
      return;
    }
    const macValue = (formData.mac_address || '').trim();
    if (macValue && !isValidMacAddress(macValue)) {
      toast.error('MAC Address ไม่ถูกต้อง ต้องเป็นรูปแบบ AA:BB:CC:DD:EE:FF (ตัวพิมพ์ใหญ่) เท่านั้น');
      return;
    }

    setSaving(true);
    try {
      const params = new URLSearchParams();
      ALL_FIELD_NAMES.forEach(name => params.append(name, formData[name] ?? ''));

      const url = isNew
        ? `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment`
        : `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}`;

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: params.toString()
      });
      const result = await response.json();

      if (response.ok) {
        if (isNew) {
          const newId = result.data?.id ?? result.id;
          toast.success(result.message || 'สร้างอุปกรณ์สำเร็จ');
          if (newId && onCreated) {
            // Switch straight into edit mode for the record we just made --
            // photo uploads need a real id, which only exists from this point on.
            justCreatedIdRef.current = newId;
            onCreated(newId);
          } else {
            onSaved && onSaved();
          }
        } else {
          toast.success(result.message || 'บันทึกข้อมูลสำเร็จ');
          onSaved && onSaved();
        }
      } else {
        toast.error(result.message || result.error || 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง');
      }
    } catch (err) {
      console.error('Failed to save equipment:', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setSaving(false);
    }
  };

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

      {!canEdit ? (
        <div className="card glass" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <ShieldAlert size={40} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{isNew ? 'คุณไม่มีสิทธิ์เพิ่มอุปกรณ์ใหม่' : 'คุณไม่มีสิทธิ์แก้ไขข้อมูลอุปกรณ์นี้'}</p>
        </div>
      ) : loading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูล...</p>
        </div>
      ) : error ? (
        <div className="card glass" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <AlertTriangle size={40} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem', textAlign: 'center' }}>
            {isNew ? 'เพิ่มอุปกรณ์สำนักงานใหม่' : 'แก้ไขข้อมูลอุปกรณ์'}
          </h1>

          <FormSection title="ข้อมูลทั่วไป">
            {GENERAL_FIELDS.map(f => (
              <FormField
                key={f.name}
                field={f}
                value={formData[f.name]}
                onChange={handleChange}
                disabled={f.name === 'status' && !!openLoan}
                disabledHint={f.name === 'status' ? 'ไม่สามารถแก้ไขสถานะได้ขณะที่อุปกรณ์ถูกยืมอยู่ กรุณาคืนอุปกรณ์ก่อน' : undefined}
              />
            ))}
          </FormSection>

          <FormSection title="สำนักงาน">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.75rem 0' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>สำนักงานการไฟฟ้า</label>
              <select
                name="pea_site_id"
                value={formData.pea_site_id ?? ''}
                onChange={handleChange}
                style={fieldInputStyle}
              >
                <option value="">-- ไม่ระบุ --</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.pea_name}{s.pea_province ? ` (${s.pea_province})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>

          <FormSection title="เครือข่าย">
            {NETWORK_FIELDS.map(f => (
              <FormField key={f.name} field={f} value={formData[f.name]} onChange={handleChange} />
            ))}
          </FormSection>

          {isNew ? (
            <FormSection title="รูปภาพอุปกรณ์">
              <p style={{ padding: '0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                บันทึกข้อมูลอุปกรณ์ก่อน จึงจะสามารถอัปโหลดรูปภาพได้
              </p>
            </FormSection>
          ) : (
          <FormSection title={`รูปภาพอุปกรณ์ (${(formData.photos || []).length}/${MAX_PHOTOS})`}>
            <div style={{ padding: '0.75rem 0' }}>
              {(formData.photos || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.85rem' }}>
                  {formData.photos.map((path, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <a href={buildImageUrl(path, formData.updatedAt)} target="_blank" rel="noreferrer">
                        <img
                          src={buildImageUrl(path, formData.updatedAt)}
                          alt={`รูปอุปกรณ์ ${i + 1}`}
                          style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}
                        />
                      </a>
                      <button
                        type="button"
                        onClick={() => setPhotoToDelete(path)}
                        title="ลบรูปนี้"
                        style={{
                          position: 'absolute', top: '-6px', right: '-6px',
                          width: '20px', height: '20px', padding: 0, borderRadius: '50%',
                          background: 'var(--accent-danger)', color: '#fff', border: '2px solid var(--card-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label
                className="glass"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: (formData.photos || []).length >= MAX_PHOTOS || uploadingPhotos ? 'not-allowed' : 'pointer',
                  opacity: (formData.photos || []).length >= MAX_PHOTOS || uploadingPhotos ? 0.5 : 1
                }}
              >
                {uploadingPhotos ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                เพิ่มรูปภาพ
                <input
                  type="file"
                  accept={FILE_INPUT_ACCEPT}
                  multiple
                  onChange={handlePhotosChange}
                  disabled={(formData.photos || []).length >= MAX_PHOTOS || uploadingPhotos}
                  style={{ display: 'none' }}
                />
              </label>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                ไฟล์ละไม่เกิน 5MB (jpeg/png/webp/gif) รวมทั้งหมดได้สูงสุด {MAX_PHOTOS} รูป
              </p>
            </div>
          </FormSection>
          )}

          <FormSection title="ครุภัณฑ์">
            {ASSET_FIELDS.map(f => (
              <FormField key={f.name} field={f} value={formData[f.name]} onChange={handleChange} />
            ))}
          </FormSection>

          <FormSection title="ที่จัดเก็บ">
            {STORAGE_FIELDS.map(f => (
              <FormField key={f.name} field={f} value={formData[f.name]} onChange={handleChange} />
            ))}
            {isNew ? (
              <p style={{ padding: '0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                บันทึกข้อมูลอุปกรณ์ก่อน จึงจะสามารถอัปโหลดรูปสถานที่จัดเก็บได้
              </p>
            ) : (
            <div style={{ padding: '0.75rem 0' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>รูปสถานที่จัดเก็บ</label>
              {formData.storage_photo ? (
                <a href={buildImageUrl(formData.storage_photo, formData.updatedAt)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
                  <img
                    src={buildImageUrl(formData.storage_photo, formData.updatedAt)}
                    alt="รูปสถานที่จัดเก็บ"
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)' }}
                  />
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  <ImageOff size={16} /> ยังไม่มีรูป
                </div>
              )}
              <label
                className="glass"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.6rem 1rem', borderRadius: '0.5rem',
                  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: uploadingStoragePhoto ? 'not-allowed' : 'pointer',
                  opacity: uploadingStoragePhoto ? 0.5 : 1,
                  width: 'fit-content'
                }}
              >
                {uploadingStoragePhoto ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {formData.storage_photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                <input
                  type="file"
                  accept={FILE_INPUT_ACCEPT}
                  onChange={handleStoragePhotoChange}
                  disabled={uploadingStoragePhoto}
                  style={{ display: 'none' }}
                />
              </label>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                ไฟล์ไม่เกิน 5MB -- อัปโหลดรูปใหม่จะแทนที่รูปเดิมทันที
              </p>
            </div>
            )}
          </FormSection>

          <FormSection title="ผู้ขาย/สัญญา">
            {VENDOR_FIELDS.map(f => (
              <FormField key={f.name} field={f} value={formData[f.name]} onChange={handleChange} />
            ))}
          </FormSection>

          <FormSection title="หมายเหตุ">
            {NOTES_FIELDS.map(f => (
              <FormField key={f.name} field={f} value={formData[f.name]} onChange={handleChange} />
            ))}
          </FormSection>

          <button
            type="submit"
            disabled={saving}
            className="glass"
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '2rem'
            }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isNew ? 'สร้างอุปกรณ์' : 'บันทึกข้อมูล'}
          </button>
        </form>
      )}

      <AnimatePresence>
        {photoToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
            }}
            onClick={() => !deletingPhoto && setPhotoToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '1.5rem', maxWidth: '320px', width: '100%', borderRadius: '0.75rem', textAlign: 'center' }}
            >
              <AlertTriangle size={36} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
              <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                ต้องการลบรูปนี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setPhotoToDelete(null)}
                  disabled={deletingPhoto}
                  className="glass"
                  style={{
                    flex: 1, padding: '0.65rem', borderRadius: '0.5rem',
                    border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
                    cursor: deletingPhoto ? 'not-allowed' : 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmDeletePhoto}
                  disabled={deletingPhoto}
                  className="glass"
                  style={{
                    flex: 1, padding: '0.65rem', borderRadius: '0.5rem', border: 'none',
                    background: 'var(--accent-danger)', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                    cursor: deletingPhoto ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  {deletingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  ลบรูป
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EquipmentEdit;
