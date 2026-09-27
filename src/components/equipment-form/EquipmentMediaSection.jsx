import { useState } from 'react';
import toast from 'react-hot-toast';
import { ImageOff, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog.jsx';

const API = import.meta.env.VITE_API_BASE_URL;
export const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
// Extensions too: some Windows setups report an empty/odd MIME type for .jpg.
const ACCEPT = [...ALLOWED_TYPES, ...ALLOWED_EXTENSIONS].join(',');

// Storage-photo re-uploads keep the same path, so bust the cache by updatedAt.
const imageUrl = (path, version) => (path ? `${API}${path}${version ? `?v=${encodeURIComponent(version)}` : ''}` : null);

const fileError = (files) => {
  for (const file of files) {
    const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!typeOk) return `ไฟล์ "${file.name}" ไม่ใช่รูปภาพที่รองรับ (jpeg/png/webp/gif)`;
    if (file.size > MAX_FILE_SIZE) return `ไฟล์ "${file.name}" มีขนาดเกิน 5MB`;
  }
  return null;
};

const send = async (url, init, fallback) => {
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch { /* optional */ }
  if (!res.ok || body?.success === false) throw new Error(body?.message || body?.error || fallback);
  return body?.message;
};

export default function EquipmentMediaSection({ equipmentId, media, token, onChanged, onBusyChange }) {
  const [uploading, setUploading] = useState({ photos: false, storage: false });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const photos = media.photos || [];
  const auth = { Authorization: `Bearer ${token}` };

  const setBusy = (key, value) => setUploading(prev => {
    const next = { ...prev, [key]: value };
    onBusyChange?.(next.photos || next.storage);
    return next;
  });

  if (!equipmentId) {
    return <p className="list-muted ef-media-note">บันทึกข้อมูลอุปกรณ์ก่อน จึงจะเพิ่มรูปอุปกรณ์และรูปสถานที่ได้ (ต้องมีรหัสอุปกรณ์ก่อน)</p>;
  }

  const uploadPhotos = async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { toast.error(`อัปโหลดรูปได้สูงสุด ${MAX_PHOTOS} รูป (มีอยู่แล้ว ${photos.length} รูป)`); return; }
    const error = fileError(files);
    if (error) { toast.error(error); return; }
    setBusy('photos', true);
    try {
      const body = new FormData();
      files.forEach(file => body.append('photos', file));
      toast.success(await send(`${API}/api/office-equipment/${equipmentId}/photos`, { method: 'POST', headers: auth, body }, 'อัปโหลดรูปภาพไม่สำเร็จ') || 'อัปโหลดรูปภาพสำเร็จ');
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setBusy('photos', false);
    }
    onChanged();
  };

  const uploadStorage = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const error = fileError([file]);
    if (error) { toast.error(error); return; }
    setBusy('storage', true);
    try {
      const body = new FormData();
      body.append('storage_photo', file);
      toast.success(await send(`${API}/api/office-equipment/${equipmentId}/storage-photo`, { method: 'POST', headers: auth, body }, 'อัปโหลดรูปไม่สำเร็จ') || 'อัปโหลดรูปสถานที่สำเร็จ');
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูป');
    } finally {
      setBusy('storage', false);
    }
    onChanged();
  };

  const deletePhoto = async () => {
    setDeleting(true);
    try {
      toast.success(await send(`${API}/api/office-equipment/${equipmentId}/photos`, {
        method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_path: toDelete })
      }, 'ลบรูปภาพไม่สำเร็จ') || 'ลบรูปภาพสำเร็จ');
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการลบรูปภาพ');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
    onChanged();
  };

  const full = photos.length >= MAX_PHOTOS;
  return (
    <div className="ef-media">
      <p className="ef-note">การเพิ่มหรือลบรูปจะบันทึกทันที แยกจากปุ่ม “บันทึก” ของข้อมูลด้านบน และจะไม่ถูกย้อนคืนเมื่อกดยกเลิก</p>

      <div className="ef-media-block">
        <h3>รูปอุปกรณ์ ({photos.length}/{MAX_PHOTOS})</h3>
        {photos.length > 0 && (
          <ul className="ef-thumbs">
            {photos.map((path, i) => (
              <li key={path}>
                <a href={imageUrl(path, media.updatedAt)} target="_blank" rel="noreferrer"><img src={imageUrl(path, media.updatedAt)} alt={`รูปอุปกรณ์ ${i + 1}`} /></a>
                <button type="button" className="ef-thumb-delete" onClick={() => setToDelete(path)} aria-label={`ลบรูปอุปกรณ์ ${i + 1}`}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <label className={`list-button ef-file${full || uploading.photos ? ' is-disabled' : ''}`}>
          {uploading.photos ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
          {uploading.photos ? 'กำลังอัปโหลด...' : 'เพิ่มรูปอุปกรณ์'}
          <input type="file" accept={ACCEPT} multiple onChange={uploadPhotos} disabled={full || uploading.photos} className="list-sr-only" />
        </label>
        <p className="list-muted">ไฟล์ละไม่เกิน 5MB (jpeg/png/webp/gif) รวมได้สูงสุด {MAX_PHOTOS} รูป</p>
      </div>

      <div className="ef-media-block">
        <h3>รูปสถานที่ติดตั้งหรือจัดเก็บ</h3>
        {media.storage_photo ? (
          <a href={imageUrl(media.storage_photo, media.updatedAt)} target="_blank" rel="noreferrer" className="ef-storage-photo">
            <img src={imageUrl(media.storage_photo, media.updatedAt)} alt="รูปสถานที่ติดตั้งหรือจัดเก็บ" />
          </a>
        ) : (
          <p className="list-muted"><ImageOff size={16} aria-hidden="true" /> ยังไม่มีรูป</p>
        )}
        <label className={`list-button ef-file${uploading.storage ? ' is-disabled' : ''}`}>
          {uploading.storage ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
          {uploading.storage ? 'กำลังอัปโหลด...' : media.storage_photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          <input type="file" accept={ACCEPT} onChange={uploadStorage} disabled={uploading.storage} className="list-sr-only" />
        </label>
        <p className="list-muted">ไฟล์ไม่เกิน 5MB — รูปใหม่จะแทนที่รูปเดิมทันที</p>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)} title="ลบรูปอุปกรณ์" tone="danger" confirmLabel="ลบรูป" busy={deleting}
        message="ต้องการลบรูปนี้ใช่หรือไม่? การลบบันทึกทันทีและย้อนกลับไม่ได้"
        onConfirm={deletePhoto} onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
