import { AlertTriangle, ListFilter } from 'lucide-react';
import useOfficeDashboardResource, { usePageClamp } from './useOfficeDashboardResource.js';
import { formatCount, formatDay, typeBreakdown } from './officeDashboardData.js';
import { EXPIRY_BUCKETS, EXPIRY_LABELS } from './officeDashboardState.js';
import { Pager, Panel } from './dashboardParts.jsx';

const SORTS = { earliest_expiry_date: 'วันสิ้นสุดที่เร็วที่สุด', contract_no: 'เลขที่สัญญา', equipment_count: 'จำนวนอุปกรณ์' };
const SHOWN_DATES = 3;

// Every distinct date of a contract with how many devices carry it; a
// contract with several dates is never shown as having just one.
function DateList({ values }) {
  if (!values?.length) return <span className="oed-none">—</span>;
  if (values.length === 1) return <span>{values[0].value === null ? 'ไม่มีวันที่' : formatDay(values[0].value)}</span>;
  const shown = values.slice(0, SHOWN_DATES);
  return (
    <ul className="oed-datelist">
      {shown.map(d => <li key={d.value ?? '∅'}>{d.value === null ? 'ไม่มีวันที่' : formatDay(d.value)} <span className="list-muted">({formatCount(d.count)})</span></li>)}
      {values.length > SHOWN_DATES && <li className="list-muted">และอีก {values.length - SHOWN_DATES} ค่า</li>}
    </ul>
  );
}

export default function ContractsTab({ state, nonce, onChange, onDrill }) {
  const contracts = useOfficeDashboardResource('contracts', state, { nonce });
  usePageClamp(contracts, state.c_page, p => onChange({ c_page: p }));
  const rows = contracts.data;
  const unit = state.group === 'computer' ? 'เครื่อง' : 'รายการ';
  const filtered = Boolean(state.expiry_bucket);

  return (
    <Panel id="oed-contracts" title="สัญญา" resource={contracts}
      subtitle={contracts.pagination && contracts.meta
        ? `${formatCount(contracts.pagination.total)} สัญญา · อุปกรณ์${filtered ? 'ที่ผ่านเงื่อนไขวันสิ้นสุด' : ''} ${formatCount(contracts.meta.equipment_total)} ${unit}`
        : null}>
      <div className="oed-table-tools">
        <label className={`oed-inline-field${filtered ? ' is-active' : ''}`}>วันสิ้นสุดสัญญา
          <select value={state.expiry_bucket} onChange={e => onChange({ expiry_bucket: e.target.value, c_page: 1, page: 1 })}>
            <option value="">ทุกสัญญา</option>
            {EXPIRY_BUCKETS.map(b => <option key={b} value={b}>{EXPIRY_LABELS[b]}</option>)}
          </select>
        </label>
        <label className="oed-inline-field">เรียงตาม
          <select value={state.c_sort} onChange={e => onChange({ c_sort: e.target.value, c_order: e.target.value === 'equipment_count' ? 'desc' : 'asc', c_page: 1 })}>
            {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="oed-inline-field">ลำดับ
          <select value={state.c_order} onChange={e => onChange({ c_order: e.target.value, c_page: 1 })}>
            <option value="asc">น้อยไปมาก / เก่าไปใหม่</option>
            <option value="desc">มากไปน้อย / ใหม่ไปเก่า</option>
          </select>
        </label>
      </div>
      {filtered && <p className="list-muted oed-note">จำนวนอุปกรณ์ในแต่ละสัญญานับเฉพาะเครื่องที่ตรงเงื่อนไข “{EXPIRY_LABELS[state.expiry_bucket]}” ไม่ใช่ทุกเครื่องของสัญญา</p>}
      {rows && (
        <>
          <div className="list-table-scroll" tabIndex={0} aria-label="ตารางสัญญา เลื่อนซ้ายขวาได้">
            <table className="list-table oed-table">
              <caption className="list-sr-only">สัญญาตามตัวกรอง หน้า {state.c_page}</caption>
              <thead><tr>
                <th scope="col">เลขที่สัญญา</th><th scope="col">อุปกรณ์</th><th scope="col">วันเริ่มสัญญา</th><th scope="col">วันสิ้นสุดสัญญา</th>
                <th scope="col">หมายเหตุ</th><th scope="col"><span className="list-sr-only">คำสั่ง</span></th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="list-empty">ไม่พบสัญญาตามตัวกรองนี้</td></tr>
                ) : rows.map(row => (
                  <tr key={row.contract_no ?? '∅'}>
                    <th scope="row" className="oed-rowhead">{row.contract_no ?? <span className="list-muted">ไม่ระบุสัญญา</span>}</th>
                    <td><strong className="list-number">{formatCount(row.equipment_count)}</strong> {unit}<div className="list-muted">{typeBreakdown(row.by_type)}</div></td>
                    <td><DateList values={row.start_dates} /></td>
                    <td><DateList values={row.expiry_dates} /></td>
                    <td>
                      {row.date_inconsistent && <span className="list-status list-status-warning"><AlertTriangle size={14} aria-hidden="true" /> วันที่สัญญาไม่ตรงกัน</span>}
                      {row.missing_expiry_count > 0 && <div className="list-muted">ไม่มีวันสิ้นสุด {formatCount(row.missing_expiry_count)} {unit}</div>}
                    </td>
                    <td>
                      <button type="button" className="list-button" disabled={contracts.stale}
                        onClick={() => onDrill(row.drilldown || (row.contract_no === null ? { missing_field: 'contract_no' } : { contract_no: row.contract_no }), { expiry_bucket: state.expiry_bucket })}>
                        <ListFilter size={16} aria-hidden="true" /> ดูรายการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager label="แบ่งหน้ารายการสัญญา" pagination={contracts.pagination} page={state.c_page} unit="สัญญา" disabled={contracts.loading}
            onPage={p => onChange({ c_page: p })} />
        </>
      )}
    </Panel>
  );
}
