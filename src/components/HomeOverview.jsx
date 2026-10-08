import { AlertTriangle, ArrowRight, Laptop, Monitor, RefreshCw, UserX, Cpu } from 'lucide-react';
import SitesMap from './SitesMap';
import useOfficeDashboardResource from './office-dashboard/useOfficeDashboardResource.js';
import { formatCount, formatDateTime } from './office-dashboard/officeDashboardData.js';
import { DEFAULT_STATE, stateToSearch } from './office-dashboard/officeDashboardState.js';
import './office-dashboard/OfficeEquipmentDashboard.css';

const COMPUTERS = { ...DEFAULT_STATE, group: 'computer' };
const typeCount = (summary, type) => summary?.by_type?.find(t => t.value === type)?.count ?? 0;

// Each card opens the dashboard table filtered to exactly what it counts.
const CARDS = [
  { id: 'total', label: 'คอมพิวเตอร์ทั้งหมด', icon: Cpu, value: s => s.total_equipment, search: { tab: 'equipment' } },
  { id: 'pc', label: 'PC', icon: Monitor, value: s => typeCount(s, 'PC'), search: { tab: 'equipment', equipment_type: 'PC' } },
  { id: 'notebook', label: 'Notebook', icon: Laptop, value: s => typeCount(s, 'Notebook'), search: { tab: 'equipment', equipment_type: 'Notebook' } },
  { id: 'owner', label: 'ไม่มีผู้ครอบครอง', icon: UserX, value: s => s.missing_owner_count, search: { tab: 'equipment', issue: 'missing_owner' }, warn: true }
];

function ComputerSummary({ onOpenDashboard }) {
  const summary = useOfficeDashboardResource('summary', COMPUTERS);
  const s = summary.data;
  return (
    <section className="home-computers" aria-labelledby="home-computers-title">
      <div className="home-computers-head">
        <div>
          <h2 id="home-computers-title">อุปกรณ์คอมพิวเตอร์ในระบบ</h2>
          <p className="list-muted">
            ไม่รวมจอภาพและอุปกรณ์อื่น{summary.meta?.generated_at && <> · ข้อมูล ณ {formatDateTime(summary.meta.generated_at)}</>}
          </p>
        </div>
        <button type="button" className="list-button" onClick={() => onOpenDashboard(stateToSearch(COMPUTERS))}>
          ดูรายละเอียดคอมพิวเตอร์ <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      {summary.error && !s ? (
        <div className="list-error oed-inline-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>โหลดสรุปคอมพิวเตอร์ไม่สำเร็จ</strong><p>{summary.error.message}</p></div>
          <button type="button" className="list-button" onClick={summary.retry}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
        </div>
      ) : (
        <ul className="oed-kpis" aria-busy={summary.loading}>
          {CARDS.map(card => (
            <li key={card.id}>
              <button type="button" className={`oed-kpi${card.warn ? ' oed-kpi-warn' : ''}`} disabled={!s}
                onClick={() => onOpenDashboard(stateToSearch({ ...COMPUTERS, ...card.search }))}>
                <span className="oed-kpi-label"><card.icon size={18} aria-hidden="true" /> {card.label}</span>
                {/* Never a 0 standing in for "not loaded yet". */}
                <span className="oed-kpi-value">{s ? formatCount(card.value(s)) : <span className="oed-skeleton" aria-label="กำลังโหลด" />}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const HomeOverview = ({ onDeviceClick, onOpenDashboard }) => (
  <SitesMap onDeviceClick={onDeviceClick} intro={<ComputerSummary onOpenDashboard={onOpenDashboard} />} />
);

export default HomeOverview;
