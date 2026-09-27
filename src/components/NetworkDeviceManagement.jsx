import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Copy, Edit2, FileSpreadsheet, Loader2, Plus, RefreshCw, Save, Search, Terminal, Trash2 } from 'lucide-react';
import ConfirmDialog from './equipment-form/ConfirmDialog.jsx';
import { setNavigationGuard, clearNavigationGuard } from '../navigationGuard';
import './ListPage.css';
import './NetworkDeviceManagement.css';

const API = import.meta.env.VITE_API_BASE_URL;
const VIEW_KEY = 'netdev.view.v1';
const PAGE_SIZES = [10, 25, 50, 100];
const SORT_KEYS = ['pea_name', 'pea_type', 'gateway', 'province'];

// Some records carry a protocol prefix ("ssh://172...") that would double up.
const cleanHost = (value) => String(value ?? '').trim().replace(/^[a-z]+:\/\//i, '');
// Real data uses "-" as an empty placeholder.
const present = (value) => { const v = cleanHost(value); return v && v !== '-' ? v : ''; };

const SECTIONS = [
  { title: 'ข้อมูลสำนักงาน', fields: [
    { name: 'pea_name', label: 'ชื่อสำนักงาน/อุปกรณ์', required: true },
    { name: 'pea_type', label: 'ประเภทสำนักงาน' },
    { name: 'province', label: 'จังหวัด' },
    { name: 'web', label: 'ชื่อที่แสดงบนเว็บ' }
  ] },
  { title: 'เครือข่ายหลัก', fields: [
    { name: 'gateway', label: 'Gateway IP', required: true, mono: true, hint: 'ใช้ตรวจสถานะอุปกรณ์' },
    { name: 'network_id', label: 'Network ID', mono: true },
    { name: 'subnet', label: 'Subnet', mono: true, placeholder: 'เช่น /24' },
    { name: 'dhcp', label: 'DHCP Range', mono: true },
    { name: 'gateway_backup', label: 'Gateway สำรอง', mono: true }
  ] },
  { title: 'วงย่อย', fields: [
    { name: 'sub_ip1_gateway', label: 'วงย่อย 1 — Gateway', mono: true },
    { name: 'sub_ip1_subnet', label: 'วงย่อย 1 — Subnet', mono: true },
    { name: 'sub_ip2_gateway', label: 'วงย่อย 2 — Gateway', mono: true },
    { name: 'sub_ip2_subnet', label: 'วงย่อย 2 — Subnet', mono: true }
  ] },
  { title: 'WAN และ VPN', fields: [
    { name: 'wan_gateway_mpls', label: 'WAN Gateway MPLS', mono: true },
    { name: 'wan_ip_fgt', label: 'WAN IP FortiGate', mono: true, hint: 'ใช้ตรวจแทนเมื่อ Gateway ไม่ตอบ' },
    { name: 'vpn_main', label: 'VPN หลัก', mono: true },
    { name: 'vpn_backup', label: 'VPN สำรอง', mono: true }
  ] }
];
const FIELDS = SECTIONS.flatMap(s => s.fields);
// pea_site_id is not edited here but is sent back unchanged in case the
// backend replaces the whole record on PUT.
const WRITABLE = [...FIELDS.map(f => f.name), 'pea_site_id'];
const emptyDraft = () => Object.fromEntries(WRITABLE.map(k => [k, '']));
const draftFrom = (device) => Object.fromEntries(WRITABLE.map(k => [k, device[k] === null || device[k] === undefined ? '' : String(device[k])]));

const readView = () => {
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
      type: typeof v.type === 'string' ? v.type : '',
      page: Number.isInteger(v.page) && v.page > 0 ? v.page : 1,
      pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 10,
      sort: SORT_KEYS.includes(v.sort?.key) && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : { key: null, order: 'asc' }
    };
  } catch {
    return { search: '', type: '', page: 1, pageSize: 10, sort: { key: null, order: 'asc' } };
  }
};

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    // Clipboard API needs HTTPS; plain-HTTP deployments use execCommand.
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(area);
    return ok;
  }
};

const NetworkDeviceManagement = ({ token, onBack, user, onDeviceClick }) => {
  const canEdit = user?.role === 'super_admin' || user?.role === 'network_admin';
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [type, setType] = useState(view.type);
  const [page, setPage] = useState(view.page);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [sort, setSort] = useState(view.sort);
  const [state, setState] = useState({ status: 'loading', devices: [], error: '' });
  const [editing, setEditing] = useState(null); // null | { id: null|number }
  const [draft, setDraft] = useState(emptyDraft);
  const [baseline, setBaseline] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inflight = useRef(null);
  const formRef = useRef(null);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${API}/api/devices`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const body = await res.json().catch(() => null);
      const list = Array.isArray(body) ? body : body?.data;
      if (!res.ok || body?.success === false || !Array.isArray(list)) throw new Error(body?.message || `HTTP ${res.status}`);
      if (inflight.current !== controller) return true;
      setState({ status: 'ready', devices: list.filter(Boolean), error: '' });
      return true;
    } catch (err) {
      if (inflight.current !== controller) return false;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลไม่สำเร็จ';
      setState(s => ({ ...s, status: s.devices.length ? 'stale' : 'error', error: message }));
      return false;
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ search, type, page, pageSize, sort })); } catch { /* not remembered */ }
  }, [search, type, page, pageSize, sort]);

  const dirty = editing && WRITABLE.some(k => draft[k] !== baseline[k]);

  // The form has no URL of its own: a marker history entry lets browser Back
  // close the form instead of leaving the page.
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = Boolean(dirty); });
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!editing) return undefined;
    const onPop = () => {
      if (leavingRef.current) { leavingRef.current = false; setEditing(null); setConfirmDiscard(false); return; }
      // Back with unsaved edits: restore the marker entry and ask first.
      if (dirtyRef.current) { window.history.pushState({ ndmEditing: true }, '', window.location.pathname); setConfirmDiscard(true); return; }
      setEditing(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [editing]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    // Sidebar/in-app navigation asks via App; Back is handled above.
    const release = setNavigationGuard(() => true, { handlesPopstate: true });
    return () => { window.removeEventListener('beforeunload', warn); release(); };
  }, [dirty]);

  const openForm = (device) => {
    if (!canEdit) return;
    window.history.pushState({ ndmEditing: true }, '', window.location.pathname);
    const next = device ? draftFrom(device) : emptyDraft();
    setDraft(next); setBaseline(next); setErrors({}); setFormError('');
    setEditing({ id: device ? device.id : null, name: device?.pea_name || '' });
  };

  const closeForm = () => {
    clearNavigationGuard();
    setConfirmDiscard(false);
    if (window.history.state?.ndmEditing) { leavingRef.current = true; window.history.back(); } else setEditing(null);
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : closeForm());

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    const found = {};
    if (!draft.pea_name.trim()) found.pea_name = 'กรุณากรอกชื่อสำนักงาน/อุปกรณ์';
    if (!draft.gateway.trim()) found.gateway = 'กรุณากรอก Gateway IP';
    setErrors(found);
    const first = FIELDS.find(f => found[f.name]);
    if (first) { formRef.current?.querySelector(`#ndm-${first.name}`)?.focus(); return; }
    setSaving(true);
    setFormError('');
    try {
      const params = new URLSearchParams();
      WRITABLE.forEach(k => { if (k !== 'pea_site_id' || draft.pea_site_id) params.append(k, draft[k].trim()); });
      const res = await fetch(editing.id == null ? `${API}/api/devices` : `${API}/api/devices/${editing.id}`, {
        method: editing.id == null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${token}` },
        body: params.toString()
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) {
        setFormError(res.status === 401 ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : res.status === 403 ? 'คุณไม่มีสิทธิ์แก้ไขอุปกรณ์เครือข่าย' : body?.message || body?.error || 'บันทึกข้อมูลไม่สำเร็จ');
        return;
      }
      toast.success(body?.message || (editing.id == null ? 'เพิ่มอุปกรณ์สำเร็จ' : 'บันทึกข้อมูลสำเร็จ'));
      closeForm();
      if (!(await load())) toast.error('บันทึกแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ — กดรีเฟรช ไม่ต้องบันทึกซ้ำ');
    } catch {
      setFormError(editing.id == null
        ? 'ไม่ได้รับคำตอบจากเซิร์ฟเวอร์ ไม่ทราบว่าเพิ่มสำเร็จหรือไม่ — ตรวจสอบรายการก่อนบันทึกอีกครั้ง'
        : 'ไม่ได้รับคำตอบจากเซิร์ฟเวอร์ ไม่ทราบว่าบันทึกสำเร็จหรือไม่ กรุณาลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/devices/${toDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success === false) throw new Error(res.status === 403 ? 'คุณไม่มีสิทธิ์ลบอุปกรณ์' : body?.message || 'ลบอุปกรณ์ไม่สำเร็จ');
      toast.success(body?.message || 'ลบอุปกรณ์สำเร็จ');
      setToDelete(null);
      if (!(await load())) toast.error('ลบแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const devices = state.devices;
  const types = useMemo(() => {
    const set = new Set(devices.map(d => d.pea_type).filter(Boolean));
    if (type) set.add(type);
    return [...set].sort((a, b) => a.localeCompare(b, 'th'));
  }, [devices, type]);
  const q = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    const list = devices.filter(d => (!type || d.pea_type === type) && (!q || ['pea_name', 'pea_type', 'gateway', 'province', 'network_id', 'wan_ip_fgt'].some(k => String(d[k] ?? '').toLocaleLowerCase().includes(q))));
    if (!sort.key) return list;
    return [...list].sort((a, b) => {
      const r = String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'th', { numeric: true });
      return sort.order === 'asc' ? r : -r;
    });
  }, [devices, type, q, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilter = Boolean(q || type);
  const clearFilters = () => { setSearch(''); setType(''); setPage(1); };

  const toggleSort = (key) => {
    setSort(prev => (prev.key !== key ? { key, order: 'asc' } : prev.order === 'asc' ? { key, order: 'desc' } : { key: null, order: 'asc' }));
    setPage(1);
  };
  const sortHeader = (key, label) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => toggleSort(key)}>
        {label}{sort.key === key ? (sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="ndm-idle" />}
      </button>
    </th>
  );

  const exportExcel = () => {
    if (!devices.length) { toast.error('ไม่มีข้อมูลอุปกรณ์สำหรับส่งออก'); return; }
    const sheet = XLSX.utils.json_to_sheet(devices.map(d => Object.fromEntries(FIELDS.map(f => [f.label, d[f.name] ?? '-']))));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'อุปกรณ์เครือข่าย');
    XLSX.writeFile(book, `Device_Management_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`ส่งออก Excel ทั้งหมดสำเร็จ (${devices.length} รายการ)`);
  };

  const hostActions = (device) => {
    const hosts = [];
    const gw = present(device.gateway);
    const wan = present(device.wan_ip_fgt);
    if (gw) hosts.push({ label: 'Gateway', value: gw });
    if (wan && wan !== gw) hosts.push({ label: 'WAN FortiGate', value: wan });
    return hosts.map(h => (
      <span key={h.label} className="ndm-host">
        <a className="list-button ndm-icon" href={`ssh://${h.value}`} aria-label={`SSH ไปยัง ${h.label} ${h.value} ของ ${device.pea_name || ''}`} title={`SSH ${h.label} (${h.value})`}><Terminal size={16} aria-hidden="true" /></a>
        <button type="button" className="list-button ndm-icon" aria-label={`คัดลอก ${h.label} ${h.value}`} title={`คัดลอก ${h.label} (${h.value})`}
          onClick={async () => ((await copyText(h.value)) ? toast.success(`คัดลอก ${h.value} แล้ว`) : toast.error('คัดลอกไม่สำเร็จ'))}><Copy size={16} aria-hidden="true" /></button>
      </span>
    ));
  };

  const nameCell = (device) => (onDeviceClick
    ? <a className="list-name" href={`/device/${device.id}`} title={device.pea_name || undefined} onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onDeviceClick(device.id); }}>{device.pea_name || `อุปกรณ์ #${device.id}`}</a>
    : <span>{device.pea_name || '—'}</span>);

  if (editing) {
    return (
      <div className="list-page ndm-page">
        <button type="button" className="list-button ndm-back" onClick={requestClose} disabled={saving}><ArrowLeft size={18} aria-hidden="true" /> กลับรายการอุปกรณ์</button>
        <form ref={formRef} className="ndm-form" onSubmit={save} noValidate aria-labelledby="ndm-form-title">
          <h2 id="ndm-form-title">{editing.id == null ? 'เพิ่มอุปกรณ์เครือข่าย' : `แก้ไขอุปกรณ์เครือข่าย${editing.name ? ` — ${editing.name}` : ''}`}</h2>
          <p className="list-muted">ช่องที่มี * จำเป็นต้องกรอก · ช่องที่ไม่มีข้อมูลเว้นว่างได้</p>
          {formError && <div className="list-error" role="alert"><AlertTriangle size={22} aria-hidden="true" /><div><p>{formError}</p></div></div>}
          <div className="ndm-sections">
            {SECTIONS.map(section => (
              <fieldset key={section.title} className="ndm-section">
                <legend>{section.title}</legend>
                <div className="ndm-fields">
                  {section.fields.map(f => {
                    const value = draft[f.name];
                    return (
                      <div key={f.name} className={`list-field ndm-field${value.trim() && value.trim() !== '-' ? ' is-active' : ''}${errors[f.name] ? ' is-invalid' : ''}`}>
                        <label htmlFor={`ndm-${f.name}`}>{f.label}{f.required && <span className="ndm-required" aria-hidden="true"> *</span>}{f.required && <span className="list-sr-only"> (จำเป็น)</span>}</label>
                        <input id={`ndm-${f.name}`} type="text" autoComplete="off" value={value} placeholder={f.placeholder} className={f.mono ? 'ndm-mono' : undefined}
                          aria-invalid={errors[f.name] ? 'true' : undefined} aria-describedby={[errors[f.name] && `ndm-${f.name}-error`, f.hint && `ndm-${f.name}-hint`].filter(Boolean).join(' ') || undefined}
                          onChange={e => { setDraft(prev => ({ ...prev, [f.name]: e.target.value })); if (errors[f.name]) setErrors(prev => ({ ...prev, [f.name]: undefined })); }} />
                        {f.hint && <p id={`ndm-${f.name}-hint`} className="ndm-hint">{f.hint}</p>}
                        {errors[f.name] && <p id={`ndm-${f.name}-error`} className="ndm-error">{errors[f.name]}</p>}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="ndm-actions">
            <span className="list-muted">{dirty ? 'มีการแก้ไขที่ยังไม่ได้บันทึก' : ''}</span>
            <div>
              <button type="button" className="list-button" onClick={requestClose} disabled={saving}>ยกเลิก</button>
              <button type="submit" className="list-button list-button-primary" disabled={saving}>
                {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />} {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </form>
        <ConfirmDialog open={confirmDiscard} title="ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?" tone="danger" confirmLabel="ทิ้งการแก้ไข" cancelLabel="แก้ไขต่อ"
          message="ข้อมูลที่แก้ไขแต่ยังไม่ได้กดบันทึกจะหายไป" onConfirm={closeForm} onCancel={() => setConfirmDiscard(false)} />
      </div>
    );
  }

  return (
    <div className="list-page ndm-page">
      <header className="list-header">
        <div>
          <button type="button" className="list-button ndm-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> กลับ</button>
          <h2>จัดการอุปกรณ์เครือข่าย</h2>
          <p>ข้อมูลวงเครือข่าย Gateway และ WAN/VPN ของแต่ละสำนักงาน{!canEdit && ' · สิทธิ์ของคุณดูได้อย่างเดียว'}</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load}><RefreshCw size={18} aria-hidden="true" /> รีเฟรช</button>
          <button type="button" className="list-button" onClick={exportExcel} disabled={!devices.length}><FileSpreadsheet size={18} aria-hidden="true" /> ส่งออก Excel ทั้งหมด</button>
          {canEdit && <button type="button" className="list-button list-button-primary" onClick={() => openForm(null)}><Plus size={18} aria-hidden="true" /> เพิ่มอุปกรณ์</button>}
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'โหลดรายการใหม่ไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดอุปกรณ์เครือข่ายไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายการอุปกรณ์เครือข่าย">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder="ชื่อ ประเภท จังหวัด Gateway หรือ Network ID" onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </label>
          <label className={`list-field${type ? ' is-active' : ''}`}>
            <span>ประเภทสำนักงาน</span>
            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">ทั้งหมด</option>
              {types.map(t => <option key={t} value={t}>{devices.some(d => d.pea_type === t) ? t : `${t} (ไม่พบในข้อมูลล่าสุด)`}</option>)}
            </select>
          </label>
          <button type="button" className="list-button" onClick={clearFilters} disabled={!hasFilter}>ล้างตัวกรอง</button>
        </div>
        {state.status !== 'loading' && state.status !== 'error' && <div className="list-result-info" role="status"><span>{hasFilter ? `พบ ${filtered.length} จาก ${devices.length} รายการ` : `ทั้งหมด ${devices.length} รายการ`}</span></div>}

        {state.status === 'loading' ? (
          <div className="ndm-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</div>
        ) : state.status === 'error' ? (
          <div className="ndm-state">ยังไม่มีข้อมูลให้แสดง</div>
        ) : rows.length === 0 ? (
          <div className="ndm-state"><p>{hasFilter ? 'ไม่พบอุปกรณ์ตามตัวกรอง' : 'ยังไม่มีอุปกรณ์เครือข่าย'}</p>{hasFilter && <button type="button" className="list-button" onClick={clearFilters}>ล้างตัวกรอง</button>}</div>
        ) : (
          <>
            <div className="list-table-scroll ndm-table" tabIndex={0} role="region" aria-label="ตารางอุปกรณ์เครือข่าย">
              <table className="list-table">
                <caption className="list-sr-only">อุปกรณ์เครือข่าย หน้า {currentPage} จาก {totalPages}</caption>
                <thead><tr>
                  <th scope="col" className="ndm-num">ลำดับ</th>
                  {sortHeader('pea_name', 'ชื่อสำนักงาน/อุปกรณ์')}
                  {sortHeader('pea_type', 'ประเภท')}
                  {sortHeader('gateway', 'Gateway IP')}
                  {sortHeader('province', 'จังหวัด')}
                  <th scope="col"><span className="list-sr-only">คำสั่ง</span></th>
                </tr></thead>
                <tbody>
                  {rows.map((d, i) => (
                    <tr key={d.id}>
                      <td className="ndm-num list-number">{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{nameCell(d)}</td>
                      <td>{d.pea_type || '—'}</td>
                      <td className="list-ip">{present(d.gateway) || '—'}</td>
                      <td>{d.province || '—'}</td>
                      <td><div className="ndm-row-actions">
                        {hostActions(d)}
                        {canEdit && <button type="button" className="list-button ndm-icon" onClick={() => openForm(d)} aria-label={`แก้ไข ${d.pea_name || d.id}`}><Edit2 size={16} aria-hidden="true" /></button>}
                        {canEdit && <button type="button" className="list-button ndm-icon ndm-danger" onClick={() => setToDelete(d)} aria-label={`ลบ ${d.pea_name || d.id}`}><Trash2 size={16} aria-hidden="true" /></button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="ndm-cards">
              {rows.map(d => (
                <li key={d.id}>
                  <div className="ndm-card-name">{nameCell(d)}</div>
                  <dl>
                    <div><dt>Gateway</dt><dd className="list-ip">{present(d.gateway) || '—'}</dd></div>
                    <div><dt>ประเภท / จังหวัด</dt><dd>{[d.pea_type, d.province].filter(Boolean).join(' · ') || '—'}</dd></div>
                  </dl>
                  <div className="ndm-row-actions ndm-card-actions">
                    {hostActions(d)}
                    {canEdit && <button type="button" className="list-button" onClick={() => openForm(d)}><Edit2 size={16} aria-hidden="true" /> แก้ไข</button>}
                    {canEdit && <button type="button" className="list-button ndm-danger" onClick={() => setToDelete(d)}><Trash2 size={16} aria-hidden="true" /> ลบ</button>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="list-footer">
              <span>แสดง {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} จาก {filtered.length} รายการ</span>
              <div className="list-pagination">
                <label>จำนวนต่อหน้า
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <button type="button" className="list-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>ก่อนหน้า</button>
                <span className="list-muted">หน้า {currentPage} / {totalPages}</span>
                <button type="button" className="list-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>ถัดไป</button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog open={Boolean(toDelete)} title="ยืนยันการลบอุปกรณ์เครือข่าย" tone="danger" confirmLabel="ลบอุปกรณ์" busy={deleting}
        message={toDelete && <>ต้องการลบ <strong>{toDelete.pea_name || `#${toDelete.id}`}</strong> ใช่หรือไม่? อุปกรณ์นี้จะหายจากการตรวจสถานะและแผนที่ การลบย้อนกลับไม่ได้</>}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
};

export default NetworkDeviceManagement;
