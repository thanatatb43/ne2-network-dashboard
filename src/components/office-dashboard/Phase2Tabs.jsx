import ExpandableRow from './ExpandableRow.jsx';
import { useState } from 'react';
import { LogIn } from 'lucide-react';
import useOfficeDashboardResource, { usePageClamp } from './useOfficeDashboardResource.js';
import { formatCount, formatDateTime, formatDay, phase2Range } from './officeDashboardData.js';
import { Pager, Panel } from './dashboardParts.jsx';

const LOAN_STATUS_LABELS = { all: 'ทุกสถานะ', open: 'ยังไม่คืน', returned: 'คืนแล้ว', overdue: 'เกินกำหนดคืน' };

export function LoginGate({ title, onLogin }) {
  return (
    <section className="list-panel oed-panel oed-gate">
      <h2>{title}</h2>
      <p>ข้อมูลส่วนนี้มีชื่อผู้ยืมและประวัติงาน จึงต้องเข้าสู่ระบบก่อน</p>
      <button type="button" className="list-button list-button-primary" onClick={onLogin}><LogIn size={18} aria-hidden="true" /> เข้าสู่ระบบ</button>
    </section>
  );
}

// From/to are applied together (the API wants both or neither).
function DateRange({ state, onChange, label }) {
  const [draft, setDraft] = useState({ base: `${state.from}|${state.to}`, from: state.from, to: state.to });
  if (draft.base !== `${state.from}|${state.to}`) setDraft({ base: `${state.from}|${state.to}`, from: state.from, to: state.to });
  const { error } = phase2Range(draft.from, draft.to);
  const dirty = draft.from !== state.from || draft.to !== state.to;
  return (
    <form className="oed-range" onSubmit={e => { e.preventDefault(); if (!error) onChange({ from: draft.from, to: draft.to }); }} aria-label={label}>
      <label className="oed-inline-field">ตั้งแต่<input type="date" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} /></label>
      <label className="oed-inline-field">ถึง<input type="date" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} /></label>
      <button type="submit" className="list-button" disabled={!dirty || Boolean(error)}>ใช้ช่วงวันที่</button>
      {(state.from || state.to) && <button type="button" className="list-button" onClick={() => onChange({ from: '', to: '' })}>ทุกวันที่</button>}
      {error && (draft.from || draft.to) && <p className="oed-range-error" role="alert">{error}</p>}
    </form>
  );
}

const rangeText = (state) => (state.from && state.to ? `${formatDay(state.from)} – ${formatDay(state.to)}` : 'ทุกวันที่');

export function LoansTab({ state, nonce, token, onChange, onEquipmentClick }) {
  const loans = useOfficeDashboardResource('loans', state, { token, nonce });
  usePageClamp(loans, state.l_page, p => onChange({ l_page: p }));
  const summary = loans.data?.summary;
  const items = loans.data?.items;
  const filtered = state.loan_status !== 'all';
  const batches = new Set((items || []).map(i => i.batch_id).filter(Boolean));
  return (
    <Panel id="oed-loans" title="ยืม-คืน" resource={loans}
      subtitle={`ช่วงวันที่เริ่มยืม: ${rangeText(state)} · ไม่ใช่ยอดค้างทั้งหมด ณ วันนั้น`}>
      <div className="oed-table-tools">
        <label className={`oed-inline-field${filtered ? ' is-active' : ''}`}>สถานะการยืม
          <select value={state.loan_status} onChange={e => onChange({ loan_status: e.target.value, l_page: 1 })}>
            {Object.entries(LOAN_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="oed-inline-field">เรียงตาม
          <select value={`${state.l_sort}:${state.l_order}`} onChange={e => { const [s, o] = e.target.value.split(':'); onChange({ l_sort: s, l_order: o, l_page: 1 }); }}>
            <option value="borrowed_at:desc">วันที่ยืม ใหม่ไปเก่า</option>
            <option value="borrowed_at:asc">วันที่ยืม เก่าไปใหม่</option>
            <option value="due_date:asc">กำหนดคืน เร็วไปช้า</option>
            <option value="due_date:desc">กำหนดคืน ช้าไปเร็ว</option>
          </select>
        </label>
        <DateRange state={state} label="ช่วงวันที่เริ่มยืม" onChange={c => onChange({ ...c, l_page: 1, r_page: 1 })} />
      </div>
      {summary && (
        <>
          {filtered && <p className="list-muted oed-note">ยอดสรุปคิดเฉพาะสถานะ “{LOAN_STATUS_LABELS[state.loan_status]}” ตามตัวกรอง</p>}
          <ul className="oed-kpis oed-kpis-small">
            <li><div className="oed-kpi"><span className="oed-kpi-label">รายการยืม</span><span className="oed-kpi-value">{formatCount(summary.loan_records)}</span></div></li>
            <li><div className="oed-kpi"><span className="oed-kpi-label">อุปกรณ์ (ไม่ซ้ำ)</span><span className="oed-kpi-value">{formatCount(summary.equipment_count)}</span></div></li>
            <li><div className="oed-kpi"><span className="oed-kpi-label">ยังไม่คืน</span><span className="oed-kpi-value">{formatCount(summary.open_loans)}</span></div></li>
            <li><div className="oed-kpi oed-kpi-danger"><span className="oed-kpi-label">เกินกำหนดคืน</span><span className="oed-kpi-value">{formatCount(summary.overdue_loans)}</span></div></li>
            <li><div className="oed-kpi"><span className="oed-kpi-label">คืนแล้ว</span><span className="oed-kpi-value">{formatCount(summary.returned_loans)}</span></div></li>
          </ul>
        </>
      )}
      {items && (
        <>
          <div className="list-table-scroll" tabIndex={0} aria-label="ตารางรายการยืม เลื่อนซ้ายขวาได้">
            <table className="list-table oed-table">
              <caption className="list-sr-only">รายการยืมตามตัวกรอง หน้า {state.l_page}</caption>
              <thead><tr><th scope="col" className="oed-expand-cell"><span className="list-sr-only">ขยายแถว</span></th><th scope="col">อุปกรณ์</th><th scope="col">ผู้ยืม</th><th scope="col">วันที่ยืม</th><th scope="col">กำหนดคืน</th><th scope="col">สถานะ</th></tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={6} className="list-empty">ไม่พบรายการยืมตามตัวกรองนี้</td></tr> : items.map(item => (
                  <ExpandableRow key={item.id} label={item.equipment_name || `รายการยืม ${item.id}`} labels={['อุปกรณ์', 'ผู้ยืม', 'วันที่ยืม', 'กำหนดคืน', 'สถานะ']}>
                    <td>
                      <a className="list-name" href={`/equipment/${item.equipment_id}`} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onEquipmentClick(item.equipment_id); } }}>{item.equipment_name || `อุปกรณ์ ${item.equipment_id}`}</a>
                      <div className="list-muted">{[item.equipment_type, item.equipment_code, item.pea_site_name].filter(Boolean).join(' · ')}</div>
                      {item.batch_id && <div className="list-muted">ยืมเป็นชุด {item.batch_id}</div>}
                    </td>
                    <td>{item.borrower_name || '—'}{item.borrower_emp_id && <div className="list-muted">{item.borrower_emp_id}</div>}</td>
                    <td>{formatDateTime(item.borrowed_at)}</td>
                    <td>{item.due_date ? formatDay(item.due_date) : <span className="list-muted">ไม่ระบุกำหนดคืน</span>}</td>
                    <td>
                      {item.returned_at
                        ? <span className="list-status list-status-up">คืนแล้ว {formatDateTime(item.returned_at)}</span>
                        : item.is_overdue ? <span className="list-status list-status-down">เกินกำหนดคืน</span> : <span className="list-status list-status-borrowed">ยังไม่คืน</span>}
                    </td>
                  </ExpandableRow>
                ))}
              </tbody>
            </table>
          </div>
          {batches.size > 0 && <p className="list-muted oed-note">รายการยืมเป็นชุดแสดงเฉพาะสมาชิกที่อยู่ในหน้านี้</p>}
          <Pager label="แบ่งหน้ารายการยืม" pagination={loans.pagination} page={state.l_page} disabled={loans.loading} onPage={p => onChange({ l_page: p })} />
        </>
      )}
    </Panel>
  );
}

export function RepairsTab({ state, nonce, token, onChange, onEquipmentClick }) {
  const repairs = useOfficeDashboardResource('repairs', state, { token, nonce });
  usePageClamp(repairs, state.r_page, p => onChange({ r_page: p }));
  const summary = repairs.data?.summary;
  const items = repairs.data?.items;
  return (
    <Panel id="oed-repairs" title="งานแจ้งซ่อม" resource={repairs} subtitle={`ช่วงวันที่แจ้ง: ${rangeText(state)}`}>
      <div className="oed-table-tools">
        <label className="oed-inline-field">เรียงตาม
          <select value={`${state.r_sort}:${state.r_order}`} onChange={e => { const [s, o] = e.target.value.split(':'); onChange({ r_sort: s, r_order: o, r_page: 1 }); }}>
            <option value="repair_count:desc">จำนวนงาน มากไปน้อย</option>
            <option value="repair_count:asc">จำนวนงาน น้อยไปมาก</option>
            <option value="last_reported_at:desc">แจ้งล่าสุด ใหม่ไปเก่า</option>
            <option value="last_reported_at:asc">แจ้งล่าสุด เก่าไปใหม่</option>
          </select>
        </label>
        <DateRange state={state} label="ช่วงวันที่แจ้ง" onChange={c => onChange({ ...c, l_page: 1, r_page: 1 })} />
      </div>
      {summary && (
        <ul className="oed-kpis oed-kpis-small">
          <li><div className="oed-kpi"><span className="oed-kpi-label">อุปกรณ์ที่มีงานแจ้งซ่อม</span><span className="oed-kpi-value">{formatCount(summary.equipment_with_repairs)}</span></div></li>
          <li><div className="oed-kpi"><span className="oed-kpi-label">งานแจ้งซ่อม (ไม่นับซ้ำ)</span><span className="oed-kpi-value">{formatCount(summary.repair_job_count)}</span></div></li>
        </ul>
      )}
      {items && (
        <>
          <p className="list-muted oed-note">งานหนึ่งอาจมีหลายเครื่อง จำนวนงานของแต่ละเครื่องจึงรวมกันไม่เท่ากับจำนวนงาน · หน้ารายละเอียดเครื่องแสดงประวัติทั้งหมด ไม่กรองตามช่วงวันที่นี้</p>
          <div className="list-table-scroll" tabIndex={0} aria-label="ตารางงานแจ้งซ่อม เลื่อนซ้ายขวาได้">
            <table className="list-table oed-table">
              <caption className="list-sr-only">อุปกรณ์ที่มีงานแจ้งซ่อม หน้า {state.r_page}</caption>
              <thead><tr><th scope="col" className="oed-expand-cell"><span className="list-sr-only">ขยายแถว</span></th><th scope="col">อุปกรณ์</th><th scope="col">สำนักงาน</th><th scope="col">จำนวนงาน</th><th scope="col">วันแจ้งล่าสุด</th></tr></thead>
              <tbody>
                {items.length === 0 ? <tr><td colSpan={5} className="list-empty">ไม่พบงานแจ้งซ่อมตามตัวกรองนี้</td></tr> : items.map(item => (
                  <ExpandableRow key={item.equipment_id} label={item.name || `อุปกรณ์ ${item.equipment_id}`} labels={['อุปกรณ์', 'สำนักงาน', 'จำนวนงาน', 'วันแจ้งล่าสุด']}>
                    <td>
                      <a className="list-name" href={`/equipment/${item.equipment_id}`} onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onEquipmentClick(item.equipment_id); } }}>{item.name || `อุปกรณ์ ${item.equipment_id}`}</a>
                      <div className="list-muted">{[item.equipment_type, item.equipment_code].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>{item.pea_site_name || '—'}</td>
                    <td className="list-number">{formatCount(item.repair_count)}</td>
                    <td>{formatDateTime(item.last_reported_at)}</td>
                  </ExpandableRow>
                ))}
              </tbody>
            </table>
          </div>
          <Pager label="แบ่งหน้างานแจ้งซ่อม" pagination={repairs.pagination} page={state.r_page} unit="เครื่อง" disabled={repairs.loading} onPage={p => onChange({ r_page: p })} />
        </>
      )}
    </Panel>
  );
}
