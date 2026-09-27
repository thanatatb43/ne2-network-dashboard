import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useDialogFocus from './useDialogFocus.js';
import './ModalFrame.css';

// Shared shell for the app's smaller modals. `busy` blocks every way of
// closing; `guardClose` (e.g. unsaved input) makes backdrop clicks do
// nothing so only the explicit close/Escape path (which can confirm) closes.
export default function ModalFrame({ title, icon, subtitle, size = 'md', busy = false, guardClose = false, onClose, children, role = 'dialog' }) {
  const id = useId();
  const ref = useRef(null);
  const requestClose = () => { if (!busy) onClose(); };
  useDialogFocus(true, ref, requestClose);
  return createPortal(
    <div className="mf-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy && !guardClose) onClose(); }}>
      <div ref={ref} role={role} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={subtitle ? `${id}-sub` : undefined} aria-busy={busy || undefined} className={`mf-dialog mf-${size}`} tabIndex={-1}>
        <div className="mf-head">
          <h2 id={`${id}-title`}>{icon}{title}</h2>
          <button type="button" className="mf-close" onClick={requestClose} disabled={busy} aria-label="ปิดหน้าต่าง"><X size={20} aria-hidden="true" /></button>
        </div>
        {subtitle && <p id={`${id}-sub`} className="mf-sub">{subtitle}</p>}
        <div className="mf-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function ModalState({ loading, error, onRetry, empty, emptyText, children }) {
  if (loading) return <p className="mf-state" role="status">กำลังโหลด...</p>;
  if (error) {
    return (
      <div className="mf-error" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" className="mf-button" onClick={onRetry}>ลองใหม่</button>}
      </div>
    );
  }
  if (empty) return <p className="mf-state">{emptyText}</p>;
  return children;
}
