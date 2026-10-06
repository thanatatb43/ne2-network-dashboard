import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { formatCount, formatDateTime } from './officeDashboardData.js';

// A titled dashboard section with its own loading / error / empty state.
// While newer data loads the old stays visible, marked as updating.
export function Panel({ id, title, subtitle, resource, actions, empty, children, className = '' }) {
  const { loading, error, data, meta, stale, retry } = resource || {};
  const showData = data !== null && data !== undefined;
  return (
    <section className={`list-panel oed-panel ${className}`} aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
      <header className="oed-panel-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle && <p className="list-muted">{subtitle}</p>}
        </div>
        {actions && <div className="oed-panel-actions">{actions}</div>}
      </header>
      {error && (
        <div className="list-error oed-inline-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>โหลดข้อมูลส่วนนี้ไม่สำเร็จ</strong><p>{error.message}{showData && ' (ข้อมูลที่เห็นด้านล่างเป็นผลก่อนหน้า ไม่ตรงกับตัวกรองปัจจุบัน)'}</p></div>
          <button type="button" className="list-button" onClick={retry}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
        </div>
      )}
      {loading && (
        <p className="oed-loading" role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> {showData ? 'กำลังอัปเดตตามตัวกรองใหม่...' : 'กำลังโหลด...'}
        </p>
      )}
      {showData && (empty ? <p className="oed-empty">{empty}</p> : <div className={stale ? 'oed-stale' : undefined}>{children}</div>)}
      {meta?.generated_at && !stale && <p className="oed-generated">ข้อมูลคำนวณเมื่อ {formatDateTime(meta.generated_at)}</p>}
    </section>
  );
}

export function Pager({ label, pagination, page, disabled, onPage, unit = 'รายการ' }) {
  if (!pagination) return null;
  const totalPages = Number(pagination.totalPages) || 0;
  const limit = Number(pagination.limit) || 0;
  const total = Number(pagination.total) || 0;
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <footer className="list-footer oed-pager">
      <span>{total ? `${formatCount(from)}–${formatCount(to)} จาก ${formatCount(total)} ${unit}` : `ไม่มี${unit}`}</span>
      {totalPages > 1 && (
        <nav className="list-pagination" aria-label={label}>
          <button type="button" className="list-button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>ก่อนหน้า</button>
          <span aria-live="polite">หน้า {formatCount(page)} / {formatCount(totalPages)}</span>
          <button type="button" className="list-button" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>ถัดไป</button>
        </nav>
      )}
    </footer>
  );
}

// A value with its share drawn as a bar; a button when it can drill down.
export function BarRow({ label, value, max, detail, onClick, disabled, tone }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const body = (
    <>
      <span className="oed-bar-label" title={label}>{label}</span>
      <span className="oed-bar-track" aria-hidden="true"><span className={`oed-bar-fill${tone ? ` oed-bar-${tone}` : ''}`} style={{ width: `${pct}%` }} /></span>
      <span className="oed-bar-value">{formatCount(value)}</span>
      {detail && <span className="oed-bar-detail">{detail}</span>}
    </>
  );
  return onClick
    ? <button type="button" className="oed-bar" onClick={onClick} disabled={disabled}>{body}</button>
    : <div className="oed-bar">{body}</div>;
}
