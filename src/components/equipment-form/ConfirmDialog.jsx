import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import useDialogFocus from '../common/useDialogFocus.js';
import '../ListPage.css';
import './ConfirmDialog.css';

export function DialogShell({ open, onClose, labelledBy, className = '', children, role = 'dialog' }) {
  const ref = useRef(null);
  useDialogFocus(open, ref, onClose);
  if (!open) return null;
  return createPortal(
    <div className="ef-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={ref} role={role} aria-modal="true" aria-labelledby={labelledBy} className={`ef-dialog ${className}`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'ยกเลิก', tone = 'primary', busy = false, onConfirm, onCancel }) {
  const id = useId();
  return (
    <DialogShell open={open} onClose={() => !busy && onCancel()} labelledBy={`${id}-title`} role="alertdialog">
      <h2 id={`${id}-title`}>{title}</h2>
      {message && <div className="ef-dialog-body">{message}</div>}
      <div className="ef-dialog-actions">
        <button type="button" className="list-button" onClick={onCancel} disabled={busy} data-autofocus>{cancelLabel}</button>
        <button type="button" className={`list-button ef-button-${tone}`} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
}
