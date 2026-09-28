import { useEffect, useId, useRef, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import './JobPickers.css';

const LIMIT = 20;

// Search-and-select equipment picker scoped to one PEA site, used twice:
// problem_equipment when a job is opened (JobFormModal) and the equipment
// used for the repair when it's closed (JobWorkflowModals).
//
// Fetches only on an explicit "ค้นหา" click (or Enter in the box), not on
// mount/site-change -- opening the form shouldn't silently pull the site's
// whole equipment list before the user has asked for anything. The selection
// lives in the caller, so it survives new searches.
const EquipmentPicker = ({ siteId, token, selected, onChange, emptySiteHint, label = 'ค้นหาอุปกรณ์' }) => {
  const id = useId();
  const [searchInput, setSearchInput] = useState('');
  // { status: 'idle' | 'loading' | 'error' | 'ready', items, total, query }
  const [state, setState] = useState({ status: 'idle', items: [], total: 0, query: '' });
  const inflight = useRef(null);

  // A stale result set from a previous site would be misleading once the
  // site changes, so clear back to the "not searched yet" state.
  useEffect(() => {
    inflight.current?.abort();
    setState({ status: 'idle', items: [], total: 0, query: '' });
    setSearchInput('');
  }, [siteId]);
  useEffect(() => () => inflight.current?.abort(), []);

  const runSearch = async () => {
    if (!siteId) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    const query = searchInput.trim();
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const params = new URLSearchParams({ pea_site_id: siteId, limit: String(LIMIT) });
      if (query) params.set('search', query);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result?.data)) throw new Error(result?.message || `HTTP ${response.status}`);
      if (inflight.current !== controller) return;
      const total = Number(result.pagination?.total);
      setState({ status: 'ready', items: result.data, total: Number.isFinite(total) ? total : result.data.length, query });
    } catch (error) {
      if (inflight.current !== controller) return;
      setState((s) => ({ ...s, status: 'error', error: error.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : 'ค้นหาอุปกรณ์ไม่สำเร็จ' }));
    } finally {
      clearTimeout(timer);
    }
  };

  const isSelected = (item) => selected.some((e) => e.id === item.id);
  const toggle = (item) => onChange(isSelected(item) ? selected.filter((e) => e.id !== item.id) : [...selected, item]);
  const remove = (itemId) => onChange(selected.filter((e) => e.id !== itemId));

  return (
    <div className="jp-picker">
      {!siteId ? (
        <p className="jp-hint">{emptySiteHint || 'เลือกสำนักงานก่อน จึงจะค้นหาอุปกรณ์ของสาขานั้นได้'}</p>
      ) : (
        <>
          <div className="jp-search">
            <label className="jp-sr-only" htmlFor={`${id}-q`}>{label}</label>
            <div className="jp-search-input">
              <Search size={16} aria-hidden="true" />
              <input
                id={`${id}-q`}
                type="search"
                placeholder="ชื่ออุปกรณ์ในสาขานี้ (เว้นว่างเพื่อดูทั้งหมด)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                // Enter searches without submitting the outer form.
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              />
            </div>
            <button type="button" className="jp-button" onClick={runSearch} disabled={state.status === 'loading'}>
              {state.status === 'loading' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />} ค้นหา
            </button>
          </div>

          <div aria-live="polite">
            {state.status === 'loading' && <p className="jp-hint">กำลังค้นหา…</p>}
            {state.status === 'error' && (
              <p className="jp-error" role="alert">{state.error} <button type="button" className="jp-link" onClick={runSearch}>ลองใหม่</button></p>
            )}
            {state.status === 'ready' && state.items.length === 0 && (
              <p className="jp-hint">{state.query ? `ไม่พบอุปกรณ์ที่ตรงกับ "${state.query}" ในสาขานี้` : 'สาขานี้ยังไม่มีอุปกรณ์ในระบบ'}</p>
            )}
            {state.status === 'ready' && state.items.length > 0 && state.total > state.items.length && (
              <p className="jp-hint">แสดง {state.items.length} จาก {state.total} รายการ ระบุคำค้นให้แคบลงถ้าไม่พบรายการที่ต้องการ</p>
            )}
          </div>

          {state.status === 'ready' && state.items.length > 0 && (
            <ul className="jp-results" aria-label="ผลการค้นหาอุปกรณ์">
              {state.items.map((item) => (
                <li key={item.id}>
                  <label className={`jp-option${isSelected(item) ? ' is-selected' : ''}`}>
                    <input type="checkbox" checked={isSelected(item)} onChange={() => toggle(item)} />
                    <span className="jp-option-name">{item.name || '-'}</span>
                    <span className="jp-option-meta">{[item.equipment_type, item.asset_number].filter(Boolean).join(' · ') || '—'}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div className="jp-selected">
          <p className="jp-selected-title">เลือกแล้ว {selected.length} รายการ</p>
          <ul className="jp-chips">
            {selected.map((item) => (
              <li key={item.id} className="jp-chip">
                <span>{item.name || '-'}</span>
                <button type="button" onClick={() => remove(item.id)} aria-label={`นำ ${item.name || 'อุปกรณ์นี้'} ออก`}><X size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EquipmentPicker;
