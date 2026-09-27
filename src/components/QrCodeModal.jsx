import React, { useState } from 'react';
import { Download, QrCode } from 'lucide-react';
import ModalFrame from './common/ModalFrame.jsx';

// Shared QR modal for one office-equipment item. updatedAt busts the cache:
// the backend regenerates the image at the same URL when the record changes.
const QrCodeModal = ({ equipmentId, equipmentName, updatedAt, onClose }) => {
  const src = `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${equipmentId}/qrcode?v=${encodeURIComponent(updatedAt || '')}`;
  const [image, setImage] = useState({ src: '', status: 'loading' });
  const status = image.src === src ? image.status : 'loading';
  return (
    <ModalFrame title="QR Code อุปกรณ์" icon={<QrCode size={20} aria-hidden="true" />} subtitle={equipmentName} size="sm" onClose={onClose}>
      <figure className="qr-figure">
        {status === 'loading' && <p className="mf-state" role="status">กำลังโหลด QR Code...</p>}
        {status === 'error' && <p className="mf-error" role="alert">โหลดรูป QR Code ไม่สำเร็จ</p>}
        <img key={src} src={src} alt={`QR Code ของ ${equipmentName || `อุปกรณ์ #${equipmentId}`}`} hidden={status !== 'ready'}
          onLoad={() => setImage({ src, status: 'ready' })} onError={() => setImage({ src, status: 'error' })} />
        <figcaption className="mf-meta">ID: {equipmentId}</figcaption>
      </figure>
      <div className="mf-actions">
        <a className="mf-button mf-primary" href={src} download={`equipment-${equipmentId}-qrcode.png`} aria-disabled={status !== 'ready'} onClick={(e) => { if (status !== 'ready') e.preventDefault(); }}>
          <Download size={18} aria-hidden="true" /> ดาวน์โหลด
        </a>
      </div>
    </ModalFrame>
  );
};

export default QrCodeModal;
