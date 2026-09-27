import './EquipmentEdit.css';
import React, { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { ChevronLeft, ShieldAlert } from 'lucide-react';
import EquipmentForm from './equipment-form/EquipmentForm.jsx';
import { canEditEquipment } from './equipment-form/equipmentFields.js';

// Page wrapper for /equipment/new/edit and /equipment/:id/edit. The office
// can be preset by the caller or by ?site_id= so a reload keeps it.
const EquipmentEdit = ({ equipmentId, token, user, onBack, onSaved, onCreated, defaultSiteId }) => {
  const isNew = equipmentId === 'new';
  const [context] = useState(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('site_id');
    const siteId = defaultSiteId ?? (fromQuery && /^\d+$/.test(fromQuery) ? fromQuery : null);
    return { source: siteId ? 'stock' : 'equipment', siteId, sitePolicy: 'selectable' };
  });
  const formRef = useRef(null);

  return (
    <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="equipment-edit-page">
      <button type="button" className="equipment-edit-back" onClick={() => (formRef.current ? formRef.current.requestCancel() : onBack())}>
        <ChevronLeft size={18} aria-hidden="true" /> ย้อนกลับ
      </button>
      <h1 className="equipment-edit-title">{isNew ? 'เพิ่มอุปกรณ์สำนักงานใหม่' : 'แก้ไขข้อมูลอุปกรณ์'}</h1>

      {!canEditEquipment(user) ? (
        <div className="list-page"><div className="list-error" role="alert">
          <ShieldAlert size={24} aria-hidden="true" />
          <div><strong>ไม่มีสิทธิ์</strong><p>{isNew ? 'คุณไม่มีสิทธิ์เพิ่มอุปกรณ์ใหม่' : 'คุณไม่มีสิทธิ์แก้ไขข้อมูลอุปกรณ์นี้'}</p></div>
        </div></div>
      ) : (
        <EquipmentForm
          equipmentId={equipmentId}
          context={context}
          user={user}
          token={token}
          heading="ข้อมูลอุปกรณ์"
          ref={formRef}
          onCancel={onBack}
          onCreated={(id) => onCreated && onCreated(id)}
          onSaved={(id) => (id ? onSaved && onSaved(id) : onBack())}
        />
      )}
    </Motion.div>
  );
};

export default EquipmentEdit;
