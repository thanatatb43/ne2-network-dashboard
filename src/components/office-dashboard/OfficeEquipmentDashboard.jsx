import { useEffect, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertTriangle, FilterX, RefreshCw, Search } from 'lucide-react';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import toast from 'react-hot-toast';
import { pushHistory, replaceHistory } from '../../navigationGuard';
import useOfficeDashboardResource from './useOfficeDashboardResource.js';
import { formatCount } from './officeDashboardData.js';
import {
  DIMENSIONS, DIMENSION_LABELS, PHASE2_TABS, activeFilterCount, applyDrilldown, changeGroup, clearFilters,
  normalizeState, parseState, pickDimension, stateToSearch, withFilters, contractDateDrilldown
} from './officeDashboardState.js';
import OverviewTab from './OverviewTab.jsx';
import EquipmentTab from './EquipmentTab.jsx';
import ContractsTab from './ContractsTab.jsx';
import { LoansTab, LoginGate, RepairsTab } from './Phase2Tabs.jsx';
import '../ListPage.css';
import '../equipment-form/ConfirmDialog.css';
import './OfficeEquipmentDashboard.css';

const DASHBOARD_PATH = '/office-equipment-dashboard';
// Loans/repairs stay hidden until the backend environment and permissions
// are confirmed (VITE_OFFICE_DASHBOARD_PHASE2=true turns them on).
const PHASE2 = import.meta.env.VITE_OFFICE_DASHBOARD_PHASE2 === 'true';
const SEARCH_DELAY_MS = 400;
const MISSING = '__missing__';

const TAB_LABELS = { overview: 'ภาพรวม', equipment: 'รายการอุปกรณ์', contracts: 'สัญญา', loans: 'ยืม-คืน', repairs: 'งานแจ้งซ่อม' };
const TABS = Object.keys(TAB_LABELS).filter(t => PHASE2 || !PHASE2_TABS.includes(t));
const SELECTOR_KEYS = { contract_no: 'contracts', pea_site_id: 'sites', department: 'departments', equipment_type: 'equipment_types', status: 'statuses' };

const allowedTab = (s) => (TABS.includes(s.tab) ? s : { ...s, tab: 'overview' });
const readUrl = () => allowedTab(parseState(window.location.search));

function DimensionSelect({ dimension, state, options, loading, onPick }) {
  const id = `oed-f-${dimension}`;
  const missing = state.missing_field === dimension;
  const value = missing ? MISSING : String(state[dimension] ?? '');
  const list = options || [];
  // Keep the current value selectable even before (or without) the selector list.
  const known = !value || value === MISSING || list.some(o => o.value !== null && String(o.value) === value);
  const missingOption = list.find(o => o.value === null);
  return (
    <div className={`list-field oed-field${value ? ' is-active' : ''}`}>
      <label htmlFor={id}>{DIMENSION_LABELS[dimension]}</label>
      <select id={id} value={value} disabled={loading && !options} onChange={e => onPick(dimension, e.target.value === MISSING ? null : e.target.value)}>
        <option value="">ทั้งหมด</option>
        {!known && <option value={value}>{value}</option>}
        {list.filter(o => o.value !== null).map(o => (
          <option key={String(o.value)} value={String(o.value)}>{o.label} ({formatCount(o.count)})</option>
        ))}
        {(missingOption || missing) && <option value={MISSING}>ไม่ระบุ{missingOption ? ` (${formatCount(missingOption.count)})` : ''}</option>}
      </select>
    </div>
  );
}

export default function OfficeEquipmentDashboard({ token, onRequireLogin, onEquipmentClick }) {
  const [state, setState] = useState(readUrl);
  const [nonce, setNonce] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [searchDraft, setSearchDraft] = useState({ base: state.search, text: state.search });
  if (searchDraft.base !== state.search) setSearchDraft({ base: state.search, text: state.search });
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Every change goes through here: the URL always mirrors what is shown.
  // Tab switches and drill-downs add a history entry (Back returns to the
  // previous view); filter, sort and page changes replace the current one.
  const commit = (next, { push = false } = {}) => {
    const s = allowedTab(normalizeState(next));
    setState(s);
    stateRef.current = s;
    const url = DASHBOARD_PATH + stateToSearch(s);
    if (window.location.pathname + window.location.search !== url) (push ? pushHistory : replaceHistory)({}, url);
  };
  const change = (changes) => commit({ ...stateRef.current, ...changes });
  const filter = (changes) => commit(withFilters(stateRef.current, changes));

  // Back/Forward between dashboard views (App has already routed here).
  useEffect(() => {
    const onPop = () => { if (window.location.pathname === DASHBOARD_PATH) setState(readUrl()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Search is debounced; typing never fires a request per keystroke.
  useEffect(() => {
    if (searchDraft.text === state.search) return undefined;
    const timer = setTimeout(() => filter({ search: searchDraft.text }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft.text, state.search]);

  const selectors = useOfficeDashboardResource('selectors', state, { nonce });

  const askReplaceMissing = (from, to, run) => setConfirm({
    title: 'เลือก “ไม่ระบุ” ได้ครั้งละหนึ่งหัวข้อ',
    message: `ระบบกรอง “ไม่ระบุ${DIMENSION_LABELS[to]}” พร้อมกับ “ไม่ระบุ${DIMENSION_LABELS[from]}” ไม่ได้ ถ้าดำเนินการต่อจะยกเลิกเงื่อนไข “ไม่ระบุ${DIMENSION_LABELS[from]}” และผลจะไม่ใช่ส่วนย่อยของรายการเดิม`,
    confirmLabel: `เปลี่ยนเป็น ไม่ระบุ${DIMENSION_LABELS[to]}`,
    run
  });

  const pick = (dimension, value) => {
    const { state: next, replaces } = pickDimension(stateRef.current, dimension, value);
    if (replaces) askReplaceMissing(replaces, dimension, () => commit(next));
    else commit(next);
  };

  const drill = (drilldown, opts = {}) => {
    const { state: next, conflict } = applyDrilldown(stateRef.current, drilldown, opts);
    if (conflict) askReplaceMissing(conflict.from, conflict.to, () => commit(applyDrilldown(stateRef.current, drilldown, { ...opts, force: true }).state, { push: true }));
    else commit(next, { push: true });
  };
  const dateDrill = (contract, field, value) => {
    const result = contractDateDrilldown(stateRef.current, contract, field, value);
    if (result.error) { toast.error(result.error, { duration: 8000 }); return; }
    commit(result.state, { push: true });
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
  const onTabKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const i = TABS.indexOf(state.tab);
    const next = TABS[Math.max(0, Math.min(TABS.length - 1, Number.isFinite(step) ? (i + step + TABS.length) % TABS.length : step < 0 ? 0 : TABS.length - 1))];
    commit({ ...state, tab: next }, { push: true });
    document.getElementById(`oed-tab-${next}`)?.focus();
  };

  const path = DASHBOARD_PATH + stateToSearch(state);
  const options = selectors.data;
  const filterCount = activeFilterCount(state) + (state.issue ? 1 : 0) + (state.expiry_bucket ? 1 : 0);
  const tabProps = { state, nonce, onChange: change, onDrill: drill, onEquipmentClick };

  return (
    <Motion.div className="list-page oed-page" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      <header className="list-header">
        <div>
          <h1>แดชบอร์ดอุปกรณ์สำนักงาน</h1>
          <p>สรุปทะเบียนอุปกรณ์ตามตัวกรอง ข้อมูลอ่านสดจากทะเบียน ตัวเลขแต่ละส่วนอาจต่างกันเล็กน้อยหากมีการแก้ทะเบียนระหว่างโหลด</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={() => setNonce(n => n + 1)}><RefreshCw size={18} aria-hidden="true" /> รีเฟรช</button>
        </div>
      </header>

      <section className="list-panel oed-filters" aria-label="ตัวกรอง">
        <div className="oed-filter-grid">
          <div className={`list-field oed-field${state.group === 'all' ? ' is-active' : ''}`}>
            <label htmlFor="oed-f-group">กลุ่มอุปกรณ์</label>
            <select id="oed-f-group" value={state.group} onChange={e => commit(changeGroup(stateRef.current, e.target.value))}>
              <option value="computer">คอมพิวเตอร์ (PC + Notebook)</option>
              <option value="all">อุปกรณ์ทั้งหมด</option>
            </select>
          </div>
          {DIMENSIONS.map(d => (
            <DimensionSelect key={d} dimension={d} state={state} options={options?.[SELECTOR_KEYS[d]]} loading={selectors.loading} onPick={pick} />
          ))}
          <div className={`list-field list-search oed-field${state.search ? ' is-active' : ''}`}>
            <label htmlFor="oed-f-search">ค้นหา</label>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input id="oed-f-search" type="search" maxLength={200} value={searchDraft.text} placeholder="ชื่อ รหัส Serial MAC ผู้ครอบครอง"
                onChange={e => setSearchDraft({ base: state.search, text: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="oed-filter-foot">
          <p className="list-muted">
            {state.group === 'computer' ? 'นับเฉพาะ PC และ Notebook' : 'นับอุปกรณ์ทุกประเภท'}
            {state.missing_field && <> · กำลังกรอง “ไม่ระบุ{DIMENSION_LABELS[state.missing_field]}” (เลือก “ไม่ระบุ” ได้ครั้งละหนึ่งหัวข้อ)</>}
          </p>
          {filterCount > 0 && (
            <button type="button" className="list-button" onClick={() => { setSearchDraft({ base: '', text: '' }); commit(clearFilters(stateRef.current)); }}>
              <FilterX size={18} aria-hidden="true" /> ล้างตัวกรอง ({filterCount})
            </button>
          )}
        </div>
        {selectors.error && (
          <div className="list-error oed-inline-error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div><strong>โหลดตัวเลือกตัวกรองไม่สำเร็จ</strong><p>{selectors.error.message}</p></div>
            <button type="button" className="list-button" onClick={selectors.retry}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>
          </div>
        )}
      </section>

      <div className="oed-tabs" role="tablist" aria-label="ส่วนของแดชบอร์ด" onKeyDown={onTabKey}>
        {TABS.map(t => (
          <button key={t} type="button" role="tab" id={`oed-tab-${t}`} aria-selected={state.tab === t} aria-controls="oed-tabpanel"
            tabIndex={state.tab === t ? 0 : -1} className={state.tab === t ? 'is-active' : undefined} onClick={() => state.tab !== t && commit({ ...state, tab: t }, { push: true })}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div id="oed-tabpanel" role="tabpanel" aria-labelledby={`oed-tab-${state.tab}`}>
        {state.tab === 'overview' && <OverviewTab {...tabProps} />}
        {state.tab === 'equipment' && <EquipmentTab {...tabProps} token={token} dashboardPath={path} onRequireLogin={onRequireLogin} />}
        {state.tab === 'contracts' && <ContractsTab {...tabProps} onDateDrill={dateDrill} />}
        {state.tab === 'loans' && (token ? <LoansTab {...tabProps} token={token} /> : <LoginGate title="ยืม-คืน" onLogin={() => onRequireLogin(path)} />)}
        {state.tab === 'repairs' && (token ? <RepairsTab {...tabProps} token={token} /> : <LoginGate title="งานแจ้งซ่อม" onLogin={() => onRequireLogin(path)} />)}
      </div>

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)} onConfirm={() => { const run = confirm.run; setConfirm(null); run(); }} />
    </Motion.div>
  );
}
