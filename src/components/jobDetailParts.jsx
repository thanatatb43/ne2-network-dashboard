import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import useDialogFocus from './common/useDialogFocus.js';
import { siteLabel, buildDocUrl, isImagePath, equipmentStatusTone, amountOf, formatBaht } from './jobReportShared';
import './ListPage.css';
import './JobReport.css';

// Read-only pieces of a job's detail, shared by the public report view
// (JobReportDetails) and the manager view (JobManagementDetails) so both show
// the same information the same way.

// In-page viewer for the notification doc / completion report (image or
// PDF) and the after-photos gallery -- keeps viewing on this page instead
// of a new tab.
export const Lightbox = ({ images, index, type, onNavigate, onClose }) => {
  const panelRef = useRef(null);
  useDialogFocus(true, panelRef, onClose);
  const many = images.length > 1;
  const go = (step) => onNavigate((index + step + images.length) % images.length);
  return createPortal(
    <div className="job-report-lightbox-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={type === 'pdf' ? `เอกสาร ${index + 1} จาก ${images.length}` : `รูปภาพ ${index + 1} จาก ${images.length}`}
        tabIndex={-1}
        className="job-report-lightbox-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        }}
      >
        <button type="button" className="job-report-lightbox-close" onClick={onClose} aria-label="ปิด">
          <X size={20} aria-hidden="true" />
        </button>
        {many && (
          <button type="button" className="job-report-lightbox-nav is-prev" onClick={() => go(-1)} aria-label="รูปก่อนหน้า">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        {type === 'pdf' ? (
          <iframe src={images[index]} title={`เอกสาร ${index + 1}`} />
        ) : (
          <img src={images[index]} alt={`รูปที่ ${index + 1} จาก ${images.length}`} />
        )}
        {many && (
          <button type="button" className="job-report-lightbox-nav is-next" onClick={() => go(1)} aria-label="รูปถัดไป">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </div>
      {many && <div className="job-report-lightbox-counter" aria-hidden="true">{index + 1} / {images.length}</div>}
    </div>,
    document.body
  );
};

// Compact clickable preview for an attached doc (image or PDF) -- a real
// <button> with an accessible name instead of an <img onClick>.
export const DocPreview = ({ path, label, onOpen }) => {
  if (!path) return null;
  const url = buildDocUrl(path);
  const isImage = isImagePath(path);
  return (
    <div className="job-report-doc-block">
      <div className="list-muted job-report-doc-label">
        <FileText size={14} aria-hidden="true" /> {label}
      </div>
      <button type="button" className="job-report-doc-preview" onClick={onOpen} aria-label={isImage ? `เปิด${label}แบบเต็มจอ` : `เปิด${label} (PDF) แบบเต็มจอ`}>
        {isImage ? (
          <img src={url} alt="" />
        ) : (
          <div className="job-report-doc-card">
            <div className="job-report-doc-icon"><FileText size={20} aria-hidden="true" /></div>
            <div>
              <div className="job-report-doc-title">ไฟล์ PDF</div>
              <div className="job-report-doc-hint">คลิกเพื่อดูแบบเต็มจอ</div>
            </div>
          </div>
        )}
      </button>
      {!isImage && (
        <a className="job-report-doc-newtab" href={url} target="_blank" rel="noopener noreferrer">
          เปิดในแท็บใหม่ <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
};

export const StatusPill = ({ status, tone }) => (
  <span className={`list-status list-status-${tone}`}>{status || 'ไม่ทราบสถานะ'}</span>
);

const EquipmentRow = ({ item, onEquipmentClick }) => (
  <div className="job-report-equipment-row">
    <span>
      {item.id && onEquipmentClick ? (
        <a
          className="job-report-equipment-link"
          href={`/equipment/${item.id}`}
          onClick={(e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              onEquipmentClick(item.id);
            }
          }}
        >
          {item.name || 'ดูรายละเอียดอุปกรณ์'}
        </a>
      ) : (item.name || '-')}
      {' '}<span className="list-muted">({item.equipment_type || '-'})</span>
    </span>
    {item.status && <StatusPill status={item.status} tone={equipmentStatusTone(item.status)} />}
  </div>
);

const docType = (path) => (isImagePath(path) ? 'image' : 'pdf');

// Main column: the reported problem, how it was handled, equipment and
// after-work photos. Transactions are left to the caller (the public view
// shows a short list, the manager view a full searchable table).
export const JobInfoMain = ({ job, onEquipmentClick, openLightbox, level = 2 }) => {
  const H = `h${level}`;
  return (
  <>
    <section className="job-report-panel">
      <H>ปัญหาที่แจ้ง</H>
      <p className="job-report-panel-body">{job.job_description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
    </section>

    {(job.assignees?.length > 0 || job.assignee_name || job.assignee_emp_id || job.work_order_no || job.progress_notes || job.closing_notes || job.cancelled_reason) && (
      <section className="job-report-panel">
        <H>การดำเนินการ</H>
        {(job.assignees?.length > 0 || job.assignee_name || job.work_order_no || job.progress_notes) ? (
          <div className="job-report-subsection">
            <div className="job-report-subsection-title">ผู้รับผิดชอบและความคืบหน้า</div>
            <dl className="job-report-field-list">
              {job.assignees?.length > 0 ? (
                <div className="job-report-field-row"><dt>ผู้รับผิดชอบ:</dt> <dd>{job.assignees.map((a) => `${a.assignee_name || a.name || '-'}${(a.assignee_emp_id || a.emp_id) ? ` (${a.assignee_emp_id || a.emp_id})` : ''}`).join(', ')}</dd></div>
              ) : job.assignee_name ? (
                <div className="job-report-field-row"><dt>ผู้รับผิดชอบ:</dt> <dd>{job.assignee_name}{job.assignee_emp_id ? ` (${job.assignee_emp_id})` : ''}</dd></div>
              ) : null}
              {job.work_order_no && <div className="job-report-field-row"><dt>เลขที่คำสั่งปฏิบัติงาน:</dt> <dd>{job.work_order_no}</dd></div>}
              {job.progress_notes && <div className="job-report-field-row"><dt>หมายเหตุความคืบหน้า:</dt> <dd>{job.progress_notes}</dd></div>}
            </dl>
          </div>
        ) : (
          <p className="list-muted">ยังไม่มีข้อมูลการดำเนินการ</p>
        )}
        {job.status !== 'ยกเลิก' && job.closing_notes && (
          <div className="job-report-subsection is-success">
            <div className="job-report-subsection-title">หมายเหตุปิดงาน</div>
            <p className="job-report-panel-body">{job.closing_notes}</p>
          </div>
        )}
        {job.cancelled_reason && (
          <div className="job-report-subsection is-danger">
            <div className="job-report-subsection-title">เหตุผลที่ยกเลิก</div>
            <p className="job-report-panel-body">{job.cancelled_reason}</p>
          </div>
        )}
      </section>
    )}

    <section className="job-report-panel">
      <H>อุปกรณ์ที่มีปัญหา</H>
      {(job.problem_equipment || []).length === 0 ? (
        <p className="list-muted">ไม่มีอุปกรณ์ที่ระบุ</p>
      ) : (
        job.problem_equipment.map((item) => <EquipmentRow key={item.id} item={item} onEquipmentClick={onEquipmentClick} />)
      )}
    </section>

    {(job.equipment || []).length > 0 && (
      <section className="job-report-panel">
        <H>อุปกรณ์ที่ใช้ดำเนินการ</H>
        {job.equipment.map((item) => <EquipmentRow key={item.id} item={item} onEquipmentClick={onEquipmentClick} />)}
      </section>
    )}

    {(job.after_photos || []).length > 0 && (
      <section className="job-report-panel">
        <H>รูปหลังดำเนินการ ({job.after_photos.length})</H>
        <div className="job-report-photos-grid">
          {job.after_photos.map((path, i) => (
            <button
              key={i}
              type="button"
              className="job-report-photo-button"
              onClick={() => openLightbox(job.after_photos.map((p) => buildDocUrl(p)), i)}
              aria-label={`ดูรูปหลังดำเนินการ ${i + 1} จาก ${job.after_photos.length}`}
            >
              <img src={buildDocUrl(path)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </section>
    )}
  </>
  );
};

// Side column: office/requester and attached documents.
export const JobInfoSide = ({ job, openLightbox, level = 2 }) => {
  const H = `h${level}`;
  return (
  <>
    <section className="job-report-panel">
      <H>สำนักงานและผู้แจ้ง</H>
      <dl className="job-report-field-list">
        <div className="job-report-field-row"><dt>สำนักงาน:</dt> <dd>{job.pea_site ? siteLabel(job.pea_site) : '—'}</dd></div>
        <div className="job-report-field-row"><dt>แผนก:</dt> <dd>{job.department || '—'}</dd></div>
        <div className="job-report-field-row"><dt>ผู้แจ้ง:</dt> <dd>{job.requester_name || '—'}</dd></div>
        <div className="job-report-field-row"><dt>รหัสพนักงานผู้แจ้ง:</dt> <dd>{job.requester_emp_id || '—'}</dd></div>
        <div className="job-report-field-row"><dt>เบอร์ติดต่อ:</dt> <dd>{job.requester_contact || '—'}</dd></div>
        {job.notification_doc_no && <div className="job-report-field-row"><dt>เลขที่หนังสือแจ้ง:</dt> <dd>{job.notification_doc_no}</dd></div>}
      </dl>
    </section>

    {(job.notification_doc_file || job.completion_report_file) && (
      <section className="job-report-panel">
        <H>เอกสาร</H>
        <DocPreview
          path={job.notification_doc_file}
          label="หนังสือแจ้ง"
          onOpen={() => openLightbox([buildDocUrl(job.notification_doc_file)], 0, docType(job.notification_doc_file))}
        />
        <DocPreview
          path={job.completion_report_file}
          label="รายงานผลการดำเนินการ"
          onOpen={() => openLightbox([buildDocUrl(job.completion_report_file)], 0, docType(job.completion_report_file))}
        />
      </section>
    )}
  </>
  );
};

// Short read-only list of linked transactions (public report view).
export const JobTransactionsBrief = ({ transactions }) => (
  <section className="job-report-panel">
    <h2>ธุรกรรมงบประมาณที่ผูกไว้</h2>
    <div className="job-report-tx-scroll" tabIndex={0} role="region" aria-label="ธุรกรรมงบประมาณที่ผูกไว้ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
      <table className="job-report-tx-table">
        <caption className="list-sr-only">ธุรกรรมงบประมาณที่ผูกกับงานนี้</caption>
        <thead>
          <tr>
            <th scope="col">วันที่ผ่านรายการ</th>
            <th scope="col">เลขที่เอกสาร</th>
            <th scope="col">รายละเอียด</th>
            <th scope="col">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => {
            const amount = amountOf(t);
            return (
              <tr key={t.id || idx}>
                <td>{t.posting_date || '—'}</td>
                <td className="list-ip">{t.reference_doc_no || '—'}</td>
                <td className="job-report-tx-desc" title={t.description}>{t.description || '—'}</td>
                <td className={`list-number job-amount${amount !== null && amount < 0 ? ' is-credit' : ''}`}>{formatBaht(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);
