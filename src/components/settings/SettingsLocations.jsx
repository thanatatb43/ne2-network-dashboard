import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Edit2, Loader2, MapPin, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import ModalFrame from '../common/ModalFrame.jsx';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import { normalizeLiveStatus, LIVE_STATUS_META } from '../deviceStatus';
import { API, COORDINATES_PATTERN, settingsPermissions, failureMessage, readJson, writeJson } from './settingsShared';
import '../ListPage.css';
import '../AdminSettings.css';

const VIEW_KEY = 'settings_locations_view.v1';
const PAGE_SIZES = [25, 50, 100, 200];
const hasCoords = (s) => s.latitude != null && s.longitude != null && s.latitude !== '' && s.longitude !== '';
const deviceStatus = (s) => (s.network_device ? normalizeLiveStatus(s.network_device.metrics).status : null);
const SORTS = {
  pea_name: { label: 'สำนักงาน', value: (s) => s.pea_name || null },
  pea_province: { label: 'จังหวัด', value: (s) => s.pea_province || null },
  coordinates: { label: 'พิกัด', value: (s) => (hasCoords(s) ? Number(s.latitude) : null) },
  network_device: { label: 'อุปกรณ์เครือข่าย', value: (s) => s.network_device?.pea_name || null }
};
const FILTERS = {
  coords: { all: 'ทั้งหมด', has: 'มีพิกัด', none: 'ไม่มีพิกัด' },
  device: { all: 'ทั้งหมด', linked: 'มีอุปกรณ์ผูกอยู่', unlinked: 'ไม่มีอุปกรณ์ผูกอยู่', online: 'อุปกรณ์ออนไลน์', offline: 'อุปกรณ์ขัดข้อง', unknown: 'ไม่ทราบสถานะ' }
};

const readView = () => {
  const v = readJson(VIEW_KEY, {}) || {};
  return {
    search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
    province: typeof v.province === 'string' ? v.province : '',
    coords: FILTERS.coords[v.coords] ? v.coords : 'all',
    device: FILTERS.device[v.device] ? v.device : 'all',
    pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 25,
    sort: SORTS[v.sort?.key] && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : { key: 'pea_name', order: 'asc' }
  };
};

export default function SettingsLocations({ token, currentUser, onBack }) {
  const { canManageLocations } = settingsPermissions(currentUser);
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [province, setProvince] = useState(view.province);
  const [coords, setCoords] = useState(view.coords);
  const [device, setDevice] = useState(view.device);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState(view.sort);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'loading', sites: [], error: '' });
  const [editing, setEditing] = useState(null); // null | { site: null | row }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const inflight = useRef(null);

  useEffect(() => { writeJson(VIEW_KEY, { search, province, coords, device, pageSize, sort }); }, [search, province, coords, device, pageSize, sort]);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState((s) => ({ ...s, status: s.sites.length ? 'refreshing' : 'loading' }));
    try {
      const response = await fetch(`${API}/api/pea-sites`, { signal: controller.signal });
      const data = await response.json().catch(() => null);
      const list = Array.isArray(data) ? data : data?.data;
      if (!response.ok || !Array.isArray(list)) throw new Error(failureMessage(response, data, `HTTP ${response.status}`));
      if (inflight.current === controller) setState({ status: 'ready', sites: list.filter(Boolean), error: '' });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดรายชื่อสำนักงานไม่สำเร็จ';
      setState((s) => ({ ...s, status: s.sites.length ? 'stale' : 'error', error: message }));
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  const provinces = [...new Set(state.sites.map((s) => s.pea_province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
  const q = search.trim().toLowerCase();
  const filtered = state.sites.filter((s) => {
    if (q && ![s.pea_name, s.pea_province].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
    if (province && s.pea_province !== province) return false;
    if (coords === 'has' && !hasCoords(s)) return false;
    if (coords === 'none' && hasCoords(s)) return false;
    const st = deviceStatus(s);
    if (device === 'linked' && !s.network_device) return false;
    if (device === 'unlinked' && s.network_device) return false;
    if (device === 'online' && st !== 'online') return false;
    if (device === 'offline' && st !== 'offline') return false;
    if (device === 'unknown' && (!s.network_device || st !== 'unknown')) return false;
    return true;
  });
  const get = SORTS[sort.key].value;
  // Blanks sort last in both directions.
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [get(a), get(b)];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'th');
    return sort.order === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * pageSize, current * pageSize);
  const filtering = Boolean(q || province || coords !== 'all' || device !== 'all');
  const clear = () => { setSearch(''); setProvince(''); setCoords('all'); setDevice('all'); setPage(1); };
  const withReset = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const sortHeader = (key) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => { setSort((s) => ({ key, order: s.key === key && s.order === 'asc' ? 'desc' : 'asc' })); setPage(1); }}>
        {SORTS[key].label}
        {sort.key !== key ? <ArrowUpDown size={14} aria-hidden="true" className="as-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(`${API}/api/pea-sites/${toDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      // 400 when devices, office equipment or jobs are still linked.
      if (!response.ok || result.success === false) throw new Error(failureMessage(response, result, 'ลบสำนักงานไม่สำเร็จ'));
      toast.success(result.message || `ลบ ${toDelete.pea_name} แล้ว`);
      setToDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.message === 'Failed to fetch' ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ สำนักงานยังไม่ถูกลบ' : err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="list-page as-page">
      <button type="button" className="list-button as-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการตั้งค่าระบบ</button>
      <header className="list-header">
        <div>
          <h1>สำนักงาน</h1>
          <p>ชื่อ จังหวัด และพิกัดที่ใช้แสดงบนแผนที่{canManageLocations ? '' : ' · เฉพาะผู้ดูแลระบบสูงสุดที่เพิ่ม แก้ไข หรือลบสำนักงานได้'}</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load} disabled={state.status === 'loading' || state.status === 'refreshing'}>
            <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          {canManageLocations && (
            <button type="button" className="list-button list-button-primary" onClick={() => setEditing({ site: null })}><Plus size={18} aria-hidden="true" /> เพิ่มสำนักงาน</button>
          )}
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'รีเฟรชไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดรายชื่อสำนักงานไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายชื่อสำนักงาน">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่อสำนักงาน หรือจังหวัด" value={search} onChange={withReset(setSearch)} />
            </div>
          </label>
          <label className={`list-field${province ? ' is-active' : ''}`}>
            <span>จังหวัด</span>
            <select value={province} onChange={withReset(setProvince)}>
              <option value="">ทุกจังหวัด</option>
              {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className={`list-field${coords !== 'all' ? ' is-active' : ''}`}>
            <span>พิกัด</span>
            <select value={coords} onChange={withReset(setCoords)}>
              {Object.entries(FILTERS.coords).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className={`list-field${device !== 'all' ? ' is-active' : ''}`}>
            <span>อุปกรณ์เครือข่าย</span>
            <select value={device} onChange={withReset(setDevice)}>
              {Object.entries(FILTERS.device).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {filtering && <button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button>}
        </div>
        {state.sites.length > 0 && (
          <div className="list-result-info"><span role="status">{filtering ? `พบ ${sorted.length} จาก ${state.sites.length} สำนักงาน` : `ทั้งหมด ${state.sites.length} สำนักงาน`}</span><span>สถานะอุปกรณ์เป็นผลตรวจล่าสุดที่ระบบบันทึก</span></div>
        )}

        {state.status === 'loading' ? (
          <div className="as-state" role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>กำลังโหลดรายชื่อสำนักงาน…</p></div>
        ) : state.sites.length === 0 ? (
          state.status === 'error' ? null : <div className="as-state"><MapPin size={24} aria-hidden="true" /><p>ยังไม่มีสำนักงานในระบบ</p></div>
        ) : sorted.length === 0 ? (
          <div className="as-state"><p><strong>ไม่พบสำนักงานที่ตรงกับเงื่อนไข</strong></p><button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button></div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางสำนักงาน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
            <table className="list-table as-table">
              <caption className="list-sr-only">รายชื่อสำนักงาน หน้า {current} จาก {totalPages}</caption>
              <thead>
                <tr>
                  {sortHeader('pea_name')}
                  {sortHeader('pea_province')}
                  {sortHeader('coordinates')}
                  {sortHeader('network_device')}
                  {canManageLocations && <th scope="col" className="as-actions-col">จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const st = deviceStatus(s);
                  const meta = st ? LIVE_STATUS_META[st] : null;
                  const latency = s.network_device ? normalizeLiveStatus(s.network_device.metrics).latency : null;
                  return (
                    <tr key={s.id}>
                      <td><span className="as-cell-main as-clip" title={s.pea_name}>{s.pea_name || '—'}</span>{s.pea_type && <span className="list-muted">{s.pea_type}</span>}</td>
                      <td>{s.pea_province || '—'}</td>
                      <td className="list-ip">{hasCoords(s) ? `${s.latitude}, ${s.longitude}` : <span className="list-muted">ไม่มีพิกัด</span>}</td>
                      <td>
                        {s.network_device ? (
                          <>
                            <span className="as-cell-main as-clip" title={s.network_device.pea_name}>{s.network_device.pea_name}</span>
                            <span className={`list-status list-status-${meta.tone}`}><span aria-hidden="true">{meta.symbol}</span> {meta.label}{latency !== null && st === 'online' ? ` · ${latency} ms` : ''}</span>
                          </>
                        ) : <span className="list-muted">ไม่มีอุปกรณ์ผูกอยู่</span>}
                      </td>
                      {canManageLocations && (
                        <td>
                          <div className="as-row-actions">
                            <button type="button" className="as-icon" onClick={() => setEditing({ site: s })} aria-label={`แก้ไข ${s.pea_name}`} title="แก้ไข"><Edit2 size={18} aria-hidden="true" /></button>
                            <button type="button" className="as-icon is-danger" onClick={() => { setDeleteError(''); setToDelete(s); }} aria-label={`ลบ ${s.pea_name}`} title="ลบ"><Trash2 size={18} aria-hidden="true" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sorted.length > 0 && (
          <footer className="list-footer">
            <span className="list-muted">{(current - 1) * pageSize + 1}–{(current - 1) * pageSize + rows.length} จาก {sorted.length} สำนักงาน</span>
            <label className="list-page-size">
              แสดง
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              รายการต่อหน้า
            </label>
            <nav className="list-pagination" aria-label="แบ่งหน้ารายชื่อสำนักงาน">
              <button type="button" className="list-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button>
              <span className="list-muted">หน้า {current} / {totalPages}</span>
              <button type="button" className="list-button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>ถัดไป</button>
            </nav>
          </footer>
        )}
      </section>

      {editing && (
        <LocationFormModal
          site={editing.site}
          provinces={provinces}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); toast.success(message); load(); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="ลบสำนักงานนี้?"
        tone="danger"
        busy={deleting}
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบสำนักงาน'}
        cancelLabel="ไม่ลบ"
        message={toDelete && (
          <>
            <p className="as-confirm-target">{toDelete.pea_name} · {toDelete.pea_province || 'ไม่ระบุจังหวัด'}</p>
            {toDelete.network_device && <p>มีอุปกรณ์เครือข่าย "{toDelete.network_device.pea_name}" ผูกอยู่ ระบบจะไม่ให้ลบจนกว่าจะย้ายหรือลบอุปกรณ์นั้น</p>}
            <p>ถ้ายังมีอุปกรณ์เครือข่าย อุปกรณ์สำนักงาน หรืองานผูกอยู่ ระบบจะไม่อนุญาตให้ลบ · ลบแล้วกู้คืนจากหน้านี้ไม่ได้</p>
            {deleteError && <p className="as-confirm-error" role="alert">{deleteError}</p>}
          </>
        )}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function LocationFormModal({ site, provinces, token, onClose, onSaved }) {
  const id = useId();
  const [initial] = useState(() => ({
    pea_name: site?.pea_name || '',
    pea_province: site?.pea_province || '',
    coordinates: site && hasCoords(site) ? `${site.latitude}, ${site.longitude}` : ''
  }));
  const [data, setData] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef(null);
  const dirty = Object.keys(initial).some((k) => initial[k] !== data[k]);

  const change = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.trim()]));
    const found = {};
    if (!trimmed.pea_name) found.pea_name = 'กรุณาระบุชื่อสำนักงาน';
    if (!trimmed.pea_province) found.pea_province = 'กรุณาระบุจังหวัด';
    if (trimmed.coordinates && !COORDINATES_PATTERN.test(trimmed.coordinates)) found.coordinates = 'รูปแบบต้องเป็น "ละติจูด, ลองจิจูด" เช่น 16.246825, 102.821954';
    setErrors(found);
    if (Object.keys(found).length) {
      formRef.current?.querySelector(`#${CSS.escape(`${id}-${Object.keys(found)[0]}`)}`)?.focus();
      return;
    }
    setBusy(true);
    setSubmitError('');
    const payload = { pea_name: trimmed.pea_name, pea_province: trimmed.pea_province, ...(trimmed.coordinates ? { coordinates: trimmed.coordinates } : {}) };
    try {
      const response = await fetch(site ? `${API}/api/pea-sites/${site.id}` : `${API}/api/pea-sites`, {
        method: site ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) { setErrors({ pea_name: result.message || 'ชื่อสำนักงานนี้มีอยู่แล้ว' }); formRef.current?.querySelector(`#${CSS.escape(`${id}-pea_name`)}`)?.focus(); return; }
      if (!response.ok || result.success === false) { setSubmitError(failureMessage(response, result, 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล')); return; }
      onSaved(result.message || (site ? 'แก้ไขสำนักงานแล้ว' : 'เพิ่มสำนักงานแล้ว'));
    } catch {
      setSubmitError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ในฟอร์มนี้');
    } finally {
      setBusy(false);
    }
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  const field = (k, label, props = {}) => (
    <div className={`mf-field${errors[k] ? ' is-invalid' : ''}`}>
      <label htmlFor={`${id}-${k}`}>{label}{props.required && <span className="br-required" aria-hidden="true"> *</span>}</label>
      <input
        id={`${id}-${k}`} type="text" value={data[k]} {...props}
        aria-invalid={errors[k] ? 'true' : undefined}
        aria-describedby={[props['aria-describedby'], errors[k] && `${id}-${k}-error`].filter(Boolean).join(' ') || undefined}
        onChange={(e) => change(k, e.target.value)}
      />
      {errors[k] && <p id={`${id}-${k}-error`} className="mf-field-error">{errors[k]}</p>}
    </div>
  );

  return (
    <>
      <ModalFrame title={site ? 'แก้ไขสำนักงาน' : 'เพิ่มสำนักงาน'} icon={<MapPin size={20} aria-hidden="true" />} subtitle={site ? site.pea_name : undefined} size="md" busy={busy} guardClose={dirty} onClose={requestClose}>
        <form ref={formRef} onSubmit={submit} noValidate>
          {submitError && <div className="mf-error as-submit-error" role="alert"><p>{submitError}</p></div>}
          {field('pea_name', 'ชื่อสำนักงาน', { required: true, placeholder: 'เช่น กฟจ.กาฬสินธุ์' })}
          {field('pea_province', 'จังหวัด', { required: true, placeholder: 'เช่น กาฬสินธุ์', list: provinces.length ? `${id}-provinces` : undefined })}
          <datalist id={`${id}-provinces`}>{provinces.map((p) => <option key={p} value={p} />)}</datalist>
          {field('coordinates', 'พิกัด (ละติจูด, ลองจิจูด)', { className: 'as-mono', inputMode: 'decimal', placeholder: '16.246825, 102.821954', 'aria-describedby': `${id}-coords-help` })}
          <p id={`${id}-coords-help`} className="mf-meta as-coords-help">คัดลอกจาก Google Maps: คลิกขวาที่ตำแหน่ง แล้วกดพิกัดที่อยู่บนสุดของเมนู · {site && hasCoords(site) ? 'ถ้าล้างช่องนี้ ระบบจะคงพิกัดเดิมไว้' : 'เว้นว่างได้'}</p>
          <div className="mf-actions">
            <button type="button" className="mf-button" onClick={requestClose} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="mf-button mf-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} บันทึก</button>
          </div>
        </form>
      </ModalFrame>
      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งข้อมูลที่กรอก?"
        message="ข้อมูลที่แก้ไขในฟอร์มนี้ยังไม่ได้บันทึกและจะหายไป"
        confirmLabel="ทิ้งข้อมูล" cancelLabel="กรอกต่อ" tone="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
