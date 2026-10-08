import { Building2, Cpu, UserCheck, UserX } from 'lucide-react';
import useOfficeDashboardResource, { usePageClamp } from './useOfficeDashboardResource.js';
import { DIST_LIMIT, expiryRanges, formatCount, typeBreakdown } from './officeDashboardData.js';
import { EXPIRY_LABELS } from './officeDashboardState.js';
import { BarRow, Pager, Panel } from './dashboardParts.jsx';

const GROUP_BY_LABELS = { site: 'สำนักงานในระบบ', department: 'แผนก', equipment_type: 'ประเภท', status: 'สถานะ' };
const DIMENSION_OF = { site: 'pea_site_id', department: 'department', equipment_type: 'equipment_type', status: 'status' };

export default function OverviewTab({ state, nonce, onDrill, onChange }) {
  const summary = useOfficeDashboardResource('summary', state, { nonce });
  const quality = useOfficeDashboardResource('quality', state, { nonce });
  const distribution = useOfficeDashboardResource('distribution', state, { nonce });
  usePageClamp(distribution, state.dist_page, p => onChange({ dist_page: p }));
  const s = summary.data;
  const unit = state.group === 'computer' ? 'เครื่อง' : 'รายการ';
  const totalLabel = state.group === 'computer' ? 'เครื่องคอมพิวเตอร์ทั้งหมด' : 'รายการอุปกรณ์ทั้งหมด';
  // Drill-down only from numbers that match the filters on screen.
  const summaryLive = Boolean(s) && !summary.stale;

  const kpis = s ? [
    { label: totalLabel, icon: Cpu, value: s.total_equipment, drill: [{}] },
    { label: 'สำนักงานในระบบ', icon: Building2, value: s.registered_site_count },
    { label: 'มีผู้ครอบครอง', icon: UserCheck, value: s.assigned_owner_count },
    { label: 'ไม่มีผู้ครอบครอง', icon: UserX, value: s.missing_owner_count, drill: [{}, { issue: 'missing_owner' }], warn: true }
  ] : [];
  const ranges = expiryRanges(s?.contract_expiry);
  const expiryCards = s ? [
    ['expired', s.contract_expiry.expired, 'danger'],
    ['within_90_days', s.contract_expiry.within_90_days, 'warn'],
    ['within_180_days', s.contract_expiry.within_180_days, 'warn'],
    ['within_365_days', s.contract_expiry.within_365_days, ''],
    ['missing_date', s.contract_expiry.missing_date, 'muted']
  ] : [];
  const maxType = Math.max(0, ...(s?.by_type || []).map(t => t.count));
  const maxStatus = Math.max(0, ...(s?.by_status || []).map(t => t.count));
  const valueDrill = (dimension, value) => (value === null ? { missing_field: dimension } : { [dimension]: value });

  const q = quality.data;
  const dist = distribution.data;
  const distMax = Math.max(0, ...(dist || []).map(r => r.total));
  const distTotal = distribution.pagination?.total;

  return (
    <div className="oed-overview">
      <Panel id="oed-kpi" title="ภาพรวม" resource={summary} className="oed-span-2">
        {s && (
          <>
            <ul className="oed-kpis">
              {kpis.map(k => (
                <li key={k.label}>
                  {k.drill ? (
                    <button type="button" className={`oed-kpi${k.warn ? ' oed-kpi-warn' : ''}`} disabled={!summaryLive} onClick={() => onDrill(...k.drill)}>
                      <span className="oed-kpi-label"><k.icon size={18} aria-hidden="true" /> {k.label}</span>
                      <span className="oed-kpi-value">{formatCount(k.value)}</span>
                    </button>
                  ) : (
                    <div className="oed-kpi">
                      <span className="oed-kpi-label"><k.icon size={18} aria-hidden="true" /> {k.label}</span>
                      <span className="oed-kpi-value">{formatCount(k.value)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="oed-subhead">วันสิ้นสุดสัญญา</h3>
            <p className="list-muted">แสดงข้อมูลเป็นยอดสะสม · *ช่วงแยก: 0–90 วัน {formatCount(ranges.d0_90)} · 91–180 วัน {formatCount(ranges.d91_180)} · 181–365 วัน {formatCount(ranges.d181_365)} {unit}</p>
            <ul className="oed-kpis oed-kpis-small">
              {expiryCards.map(([bucket, value, tone]) => (
                <li key={bucket}>
                  <button type="button" className={`oed-kpi${tone ? ` oed-kpi-${tone}` : ''}`} disabled={!summaryLive} onClick={() => onDrill({}, { expiry_bucket: bucket })}>
                    <span className="oed-kpi-label">{EXPIRY_LABELS[bucket]}</span>
                    <span className="oed-kpi-value">{formatCount(value)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="oed-split">
              <div>
                <h3 className="oed-subhead">ตามประเภท</h3>
                {s.by_type.length ? s.by_type.map(t => (
                  <BarRow key={t.value ?? '∅'} label={t.value ?? 'ไม่ระบุ'} value={t.count} max={maxType} disabled={!summaryLive}
                    onClick={() => onDrill(valueDrill('equipment_type', t.value))} />
                )) : <p className="oed-empty">ไม่มีข้อมูล</p>}
              </div>
              <div>
                <h3 className="oed-subhead">ตามสถานะ</h3>
                {s.by_status.length ? s.by_status.map(t => (
                  <BarRow key={t.value ?? '∅'} label={t.value ?? 'ไม่ระบุ'} value={t.count} max={maxStatus} disabled={!summaryLive}
                    onClick={() => onDrill(valueDrill('status', t.value))} />
                )) : <p className="oed-empty">ไม่มีข้อมูล</p>}
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel id="oed-dist" title={`การกระจายตาม${GROUP_BY_LABELS[state.dist_by]}`} resource={distribution}
        subtitle={distribution.data && distribution.meta ? `แสดงกลุ่มในหน้านี้ · ทั้งหมด ${formatCount(distTotal)} กลุ่ม · อุปกรณ์รวม ${formatCount(distribution.meta.equipment_total)} ${unit}` : null}
        empty={dist && !dist.length ? 'ไม่มีข้อมูลตามตัวกรองนี้' : null}
        actions={(
          <>
            <label className="oed-inline-field">จัดกลุ่มตาม
              <select value={state.dist_by} onChange={e => onChange({ dist_by: e.target.value, dist_page: 1 })}>
                {Object.entries(GROUP_BY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="oed-inline-field">เรียง
              <select value={state.dist_sort} onChange={e => onChange({ dist_sort: e.target.value, dist_page: 1 })}>
                <option value="total">จำนวนมากไปน้อย</option>
                <option value="label">ชื่อ ก–ฮ</option>
              </select>
            </label>
          </>
        )}>
        {dist && (
          <>
            {dist.map(row => (
              <BarRow key={String(row.key)} label={row.label ?? 'ไม่ระบุ'} value={row.total} max={distMax} disabled={distribution.stale}
                detail={state.dist_by !== 'equipment_type' ? typeBreakdown(row.by_type) : null}
                onClick={() => onDrill(row.drilldown || { [DIMENSION_OF[state.dist_by]]: row.key })} />
            ))}
            {distTotal > DIST_LIMIT && <p className="list-muted oed-note">กราฟแสดงทีละ {DIST_LIMIT} กลุ่ม ยอดของหน้านี้ไม่ใช่ยอดรวมทุกกลุ่ม</p>}
            <Pager label="แบ่งหน้ากราฟการกระจาย" pagination={distribution.pagination} page={state.dist_page} unit="กลุ่ม" disabled={distribution.loading}
              onPage={p => onChange({ dist_page: p })} />
          </>
        )}
      </Panel>

      <Panel id="oed-quality" title="ข้อมูลที่ควรตรวจสอบ" resource={quality}
        subtitle={q ? `อุปกรณ์ที่ข้อมูลอาจไม่ถูกต้อง ${formatCount(q.equipment_with_issues)} จาก ${formatCount(q.equipment_total)} ${unit}` : null}>
        {q && (
          <>
            <p className="list-muted oed-note">รายการอุปกรณ์ที่ต้องตรวจสอบรายละเอียดเพิ่มเติม</p>
            <ul className="oed-issues">
              {q.issues.map(issue => (
                <li key={issue.code}>
                  <button type="button" className="oed-issue" disabled={quality.stale || !issue.count} onClick={() => onDrill({}, { issue: issue.code })}>
                    <span>{issue.label}</span>
                    <span className={`oed-issue-count${issue.count ? ' is-nonzero' : ''}`}>{formatCount(issue.count)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
