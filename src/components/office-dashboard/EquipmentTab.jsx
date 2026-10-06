import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2, LogIn, X } from 'lucide-react';
import useOfficeDashboardResource, { usePageClamp } from './useOfficeDashboardResource.js';
import { downloadExport, formatCount, formatDay } from './officeDashboardData.js';
import { EXPIRY_LABELS, LIMITS } from './officeDashboardState.js';
import { Pager, Panel } from './dashboardParts.jsx';

const ISSUE_LABELS = {
  missing_owner: 'ไม่มีผู้ครอบครอง', missing_owner_emp_id: 'ไม่มีรหัสพนักงานผู้ครอบครอง', missing_department: 'ไม่ระบุแผนก',
  missing_site: 'ไม่ระบุสำนักงาน', missing_serial: 'ไม่มี Serial', missing_equipment_code: 'ไม่มีรหัสอุปกรณ์',
  missing_contract: 'ไม่ระบุสัญญา', missing_contract_expiry: 'ไม่มีวันสิ้นสุดสัญญา', duplicate_serial: 'Serial ซ้ำ',
  duplicate_equipment_code: 'รหัสอุปกรณ์ซ้ำ'
};
const SORT_LABELS = {
  updatedAt: 'แก้ไขล่าสุด', id: 'ID', name: 'ชื่ออุปกรณ์', equipment_type: 'ประเภท', equipment_code: 'รหัสอุปกรณ์',
  serial_number: 'Serial', department: 'แผนก', status: 'สถานะ', contract_expiry_date: 'วันสิ้นสุดสัญญา'
};
const dash = (v) => (v === null || v === undefined || String(v).trim() === '' ? <span className="oed-none" aria-label="ไม่มีข้อมูล">—</span> : v);

export default function EquipmentTab({ state, nonce, token, dashboardPath, onChange, onEquipmentClick, onRequireLogin }) {
  const equipment = useOfficeDashboardResource('equipment', state, { nonce });
  usePageClamp(equipment, state.page, p => onChange({ page: p }));
  const [exporting, setExporting] = useState(false);
  const rows = equipment.data;
  const unit = state.group === 'computer' ? 'เครื่อง' : 'รายการ';

  const runExport = async () => {
    if (!token) {
      toast.error('กรุณาเข้าสู่ระบบก่อนส่งออก Excel แล้วระบบจะพากลับมาที่ตัวกรองเดิม');
      onRequireLogin(dashboardPath);
      return;
    }
    setExporting(true);
    try {
      const result = await downloadExport(state, token);
      if (result.kind === 'file') {
        toast.success(result.total === null ? `ดาวน์โหลด ${result.filename} แล้ว` : `ส่งออก ${formatCount(result.total)} รายการแล้ว`);
      } else if (result.status === 401) {
        // App ends the session on a dead token; ask to log in again either way.
        toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อส่งออก');
      } else {
        toast.error(result.message, { duration: 8000 });
      }
    } finally {
      setExporting(false);
    }
  };

  const chips = [
    state.issue && { key: 'issue', label: `ปัญหา: ${ISSUE_LABELS[state.issue] || state.issue}` },
    state.expiry_bucket && { key: 'expiry_bucket', label: `สัญญา: ${EXPIRY_LABELS[state.expiry_bucket]}` }
  ].filter(Boolean);

  return (
    <Panel id="oed-equipment" title="รายการอุปกรณ์" resource={equipment}
      subtitle={equipment.pagination ? `ตรงตัวกรอง ${formatCount(equipment.pagination.total)} ${unit} · เรียงที่เซิร์ฟเวอร์ทั้งชุด` : null}
      actions={(
        <button type="button" className="list-button" onClick={runExport} disabled={exporting || equipment.stale || !rows}
          title={equipment.stale ? 'รอให้รายการโหลดตามตัวกรองปัจจุบันก่อน' : undefined}>
          {exporting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : token ? <Download size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
          {exporting ? 'กำลังส่งออก...' : token ? 'ส่งออก Excel' : 'เข้าสู่ระบบเพื่อส่งออก'}
        </button>
      )}>
      <div className="oed-table-tools">
        {chips.length > 0 && (
          <ul className="oed-chips" aria-label="เงื่อนไขเฉพาะตาราง">
            {chips.map(c => (
              <li key={c.key}>
                <button type="button" className="oed-chip" onClick={() => onChange({ [c.key]: '', page: 1 })} aria-label={`ล้าง ${c.label}`}>
                  {c.label} <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="oed-inline-field">เรียงตาม
          <select value={state.sort} onChange={e => onChange({ sort: e.target.value, page: 1 })}>
            {Object.entries(SORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="oed-inline-field">ลำดับ
          <select value={state.order} onChange={e => onChange({ order: e.target.value, page: 1 })}>
            <option value="desc">มากไปน้อย / ใหม่ไปเก่า</option>
            <option value="asc">น้อยไปมาก / เก่าไปใหม่</option>
          </select>
        </label>
        <label className="oed-inline-field">แสดง
          <select value={state.limit} onChange={e => onChange({ limit: Number(e.target.value), page: 1 })}>
            {LIMITS.map(n => <option key={n} value={n}>{n} รายการ</option>)}
          </select>
        </label>
      </div>
      {rows && (
        <>
          <div className="list-table-scroll" tabIndex={0} aria-label="ตารางรายการอุปกรณ์ เลื่อนซ้ายขวาได้">
            <table className="list-table oed-table">
              <caption className="list-sr-only">รายการอุปกรณ์ตามตัวกรอง หน้า {state.page}</caption>
              <thead><tr>
                <th scope="col">ชื่ออุปกรณ์</th><th scope="col">ประเภท</th><th scope="col">รหัสอุปกรณ์</th><th scope="col">Serial</th>
                <th scope="col">สำนักงาน</th><th scope="col">ผู้ครอบครอง</th><th scope="col">สถานะ</th><th scope="col">สิ้นสุดสัญญา</th><th scope="col">ควรตรวจสอบ</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="list-empty">ไม่พบอุปกรณ์ตามตัวกรองนี้</td></tr>
                ) : rows.map(row => (
                  <tr key={row.id}>
                    <td>
                      <a className="list-name" href={`/equipment/${row.id}`} title={row.name}
                        onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onEquipmentClick(row.id); } }}>
                        {row.name || `อุปกรณ์ ${row.id}`}
                      </a>
                      <span className="list-muted">ID {row.id}</span>
                    </td>
                    <td>{dash(row.equipment_type)}</td>
                    <td className="list-ip">{dash(row.equipment_code)}</td>
                    <td className="list-ip">{dash(row.serial_number)}</td>
                    <td>{dash(row.pea_site_name)}{row.department && <div className="list-muted">{row.department}</div>}</td>
                    <td>{dash(row.asset_owner)}{row.asset_owner_emp_id && <div className="list-muted">{row.asset_owner_emp_id}</div>}</td>
                    <td>{dash(row.status)}</td>
                    <td>{row.contract_expiry_date ? formatDay(row.contract_expiry_date) : dash(null)}{row.contract_no && <div className="list-muted">{row.contract_no}</div>}</td>
                    <td>
                      {row.quality_issues?.length ? (
                        <ul className="oed-badges">{row.quality_issues.map(code => <li key={code} className="list-status list-status-warning">{ISSUE_LABELS[code] || code}</li>)}</ul>
                      ) : <span className="list-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager label="แบ่งหน้ารายการอุปกรณ์" pagination={equipment.pagination} page={state.page} unit={unit} disabled={equipment.loading}
            onPage={p => onChange({ page: p })} />
        </>
      )}
    </Panel>
  );
}
