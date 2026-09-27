import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';
import './ListPage.css';
import './DownDevices.css';

const API = import.meta.env.VITE_API_BASE_URL;
const REFRESH_MS = 60000;
const TIMEOUT_MS = 15000;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const time = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

const normalize = (item) => ({
  key: item.id ?? item.device_id,
  deviceId: item.device_id ?? item.device?.id ?? null,
  name: item.device?.pea_name || '',
  type: item.device?.pea_type || '',
  province: item.device?.province || '',
  gateway: item.device?.gateway || '',
  packetLoss: num(item.packet_loss),
  checkedAt: time(item.checked_at)
});

const DownDevices = ({ onDeviceClick }) => {
  const [state, setState] = useState({ status: 'loading', rows: [], error: '', loadedAt: null, refreshing: false });
  const [search, setSearch] = useState(() => {
    try { return sessionStorage.getItem('downDevices.search.v1') || ''; } catch { return ''; }
  });
  const inflight = useRef(null);
  const lastOk = useRef(0);

  const load = useCallback(async () => {
    if (inflight.current) return;
    const controller = new AbortController();
    inflight.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    setState(s => ({ ...s, refreshing: true }));
    try {
      const res = await fetch(`${API}/api/latency/down`, { signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.success === false || !Array.isArray(body.data)) throw new Error(body?.message || `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}`);
      if (inflight.current !== controller) return;
      lastOk.current = Date.now();
      setState({ status: 'ready', rows: body.data.filter(Boolean).map(normalize), error: '', loadedAt: new Date(), refreshing: false });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = timedOut ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message || 'โหลดข้อมูลไม่สำเร็จ';
      // Keep the last good list; say it may be stale instead of claiming "nothing is down".
      setState(s => ({ ...s, status: s.loadedAt ? 'stale' : 'error', error: message, refreshing: false }));
    } finally {
      clearTimeout(timer);
      if (inflight.current === controller) inflight.current = null;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden && Date.now() - lastOk.current > REFRESH_MS) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      const c = inflight.current; inflight.current = null; c?.abort();
    };
  }, [load]);

  useEffect(() => {
    try { sessionStorage.setItem('downDevices.search.v1', search); } catch { /* not remembered */ }
  }, [search]);

  const q = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => state.rows.filter(r => !q || `${r.name} ${r.type} ${r.province} ${r.gateway}`.toLocaleLowerCase().includes(q)), [state.rows, q]);
  const hasData = state.status === 'ready' || state.status === 'stale';

  const openDevice = (event, row) => {
    if (!onDeviceClick || row.deviceId == null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onDeviceClick(row.deviceId);
  };
  const nameCell = (row) => row.deviceId != null
    ? <a className="list-name" href={`/device/${row.deviceId}`} title={row.name || undefined} onClick={e => openDevice(e, row)}>{row.name || `อุปกรณ์ #${row.deviceId}`}</a>
    : <span title={row.name}>{row.name || '—'}</span>;

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="list-page dd-page">
      <header className="list-header">
        <div>
          <h1>อุปกรณ์ที่ขัดข้อง</h1>
          <p>อุปกรณ์เครือข่ายที่ผลตรวจล่าสุดไม่ตอบสนอง{state.loadedAt && ` · โหลดล่าสุด ${state.loadedAt.toLocaleTimeString('th-TH')} · อัปเดตทุก 1 นาที`}</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load} disabled={state.refreshing}>
            <RefreshCw size={18} aria-hidden="true" className={state.refreshing ? 'animate-spin' : ''} /> รีเฟรชข้อมูล
          </button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div>
            <strong>{state.status === 'stale' ? 'อัปเดตไม่สำเร็จ ข้อมูลอาจเก่า' : 'โหลดรายการอุปกรณ์ขัดข้องไม่สำเร็จ'}</strong>
            <p>{state.error}{state.status === 'stale' && ` — แสดงผลที่โหลดสำเร็จเมื่อ ${state.loadedAt.toLocaleTimeString('th-TH')}`}{state.status === 'error' && ' — ยังไม่ทราบสถานะอุปกรณ์ ไม่ได้หมายความว่าไม่มีอุปกรณ์ขัดข้อง'}</p>
          </div>
          <button type="button" className="list-button" onClick={load} disabled={state.refreshing}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายการอุปกรณ์ที่ขัดข้อง">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหาอุปกรณ์ขัดข้อง</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={search} placeholder="ชื่อ ประเภท จังหวัด หรือ Gateway IP" onChange={e => setSearch(e.target.value)} />
            </div>
          </label>
          <button type="button" className="list-button" onClick={() => setSearch('')} disabled={!search}>ล้างคำค้น</button>
        </div>
        {hasData && <div className="list-result-info" role="status"><span>{q ? `พบ ${filtered.length} จาก ${state.rows.length} รายการ` : `ขัดข้อง ${state.rows.length} รายการ`}</span></div>}

        {state.status === 'loading' ? (
          <div className="dd-state"><Loader2 size={28} className="animate-spin" aria-hidden="true" /> กำลังโหลดข้อมูล...</div>
        ) : state.status === 'error' ? (
          <div className="dd-state">ยังไม่มีข้อมูลให้แสดง</div>
        ) : state.rows.length === 0 ? (
          <div className="dd-state dd-ok"><CheckCircle2 size={28} aria-hidden="true" /> ผลตรวจล่าสุดไม่พบอุปกรณ์ที่ขัดข้อง</div>
        ) : filtered.length === 0 ? (
          <div className="dd-state"><p>ไม่พบอุปกรณ์ขัดข้องตามคำค้น “{search.trim()}”</p><button type="button" className="list-button" onClick={() => setSearch('')}>ล้างคำค้น</button></div>
        ) : (
          <>
            <div className="list-table-scroll dd-table" tabIndex={0} role="region" aria-label="ตารางอุปกรณ์ที่ขัดข้อง">
              <table className="list-table">
                <caption className="list-sr-only">อุปกรณ์ที่ขัดข้อง {filtered.length} รายการ</caption>
                <thead><tr><th scope="col">ชื่ออุปกรณ์</th><th scope="col">ประเภท</th><th scope="col">จังหวัด</th><th scope="col">Gateway IP</th><th scope="col" className="dd-num">Packet Loss</th><th scope="col">ตรวจสอบล่าสุด</th></tr></thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.key} className="list-row-down">
                      <td>{nameCell(row)}</td>
                      <td>{row.type || '—'}</td>
                      <td>{row.province || '—'}</td>
                      <td className="list-ip">{row.gateway || '—'}</td>
                      <td className="dd-num list-number">{row.packetLoss === null ? '—' : `${row.packetLoss}%`}</td>
                      <td>{row.checkedAt ? row.checkedAt.toLocaleString('th-TH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="dd-cards">
              {filtered.map(row => (
                <li key={row.key}>
                  <div className="dd-card-name">{nameCell(row)}<span className="list-status list-status-down"><span aria-hidden="true">!</span> ขัดข้อง</span></div>
                  <dl>
                    <div><dt>Gateway IP</dt><dd className="list-ip">{row.gateway || '—'}</dd></div>
                    <div><dt>ประเภท / จังหวัด</dt><dd>{[row.type, row.province].filter(Boolean).join(' · ') || '—'}</dd></div>
                    <div><dt>Packet Loss</dt><dd>{row.packetLoss === null ? '—' : `${row.packetLoss}%`}</dd></div>
                    <div><dt>ตรวจสอบล่าสุด</dt><dd>{row.checkedAt ? row.checkedAt.toLocaleString('th-TH') : '—'}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Motion.div>
  );
};

export default DownDevices;
