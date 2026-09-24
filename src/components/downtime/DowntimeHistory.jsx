import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import useDowntime from './useDowntime';
import { bucketFilter, dateTime, defaults, duration, persist, readFilters, request, stored, todayThai, validateFilters } from './downtimeData';
import '../ListPage.css';
import './DowntimeHistory.css';

const statusLabels = { open: 'ยังขัดข้อง', resolved: 'กลับออนไลน์แล้ว', unknown: 'ไม่ทราบสถานะ' };
const number = value => value == null ? '—' : Number(value).toLocaleString('th-TH');
const name = row => row.pea_name || row.device_name || 'ไม่ทราบสำนักงาน';
function Status({ value }) { return <span className={`list-status list-status-${value === 'open' ? 'down' : value === 'resolved' ? 'up' : 'unknown'}`}>{statusLabels[value] || statusLabels.unknown}</span>; }
function ResourceState({ resource, retry, label }) {
  if (resource.error) return <div className="list-error" role="alert"><span>{label}: {resource.error}{resource.stale && ` · แสดงข้อมูลเดิม ณ ${dateTime(resource.meta?.as_of)}`}</span><button className="list-button" onClick={retry}>ลองใหม่</button></div>;
  if (resource.loading) return <p className="dt-loading" role="status">กำลังโหลด{label}…{resource.stale && ` แสดงข้อมูลเดิม ณ ${dateTime(resource.meta?.as_of)}`}</p>;
  return null;
}
function ChartTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="dt-tooltip"><strong>{row.label}</strong><p>เริ่มขัดข้อง {number(row.started_incident_count)} เหตุการณ์</p><p>เวลาสะสม: {duration(row.duration_in_range_ms)}</p><p>{row.coverage_status === 'complete' ? 'ข้อมูลครอบคลุมช่วงนี้' : 'ยังยืนยันความครบของข้อมูลไม่ได้'}</p></div>;
}
function Trend({ buckets, daily, filters, asOf, onDrill }) {
  const data = buckets.map(b => ({ ...b, label: new Date(b.period_start).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', ...(daily ? { day: 'numeric', month: 'short' } : { month: 'short', year: 'numeric' }) }) }));
  const drill = row => { const next = row && bucketFilter(row, filters, asOf); if (next) onDrill(next); };
  const axes = <><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="label" minTickGap={25} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} /><YAxis allowDecimals={false} width={45} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /></>;
  return <section className="list-panel dt-panel"><h2>จำนวนเหตุการณ์ที่เริ่ม{daily ? 'รายวัน' : 'รายเดือน'}</h2><p className="dt-note">คลิก{daily ? 'จุดบนเส้น' : 'แท่ง'}กราฟหรือเลือกช่วงในตารางเพื่อดูรายการ · หน่วย: เหตุการณ์</p>
    <div className="dt-chart" role="img" aria-label={`กราฟจำนวนเหตุการณ์${daily ? 'รายวัน' : 'รายเดือน'} มีตารางข้อมูลด้านล่าง`}><ResponsiveContainer width="100%" height="100%">
      {daily ? <LineChart data={data}>{axes}<Line dataKey="started_incident_count" name="จำนวนเหตุการณ์" type="linear" stroke="var(--list-action)" strokeWidth={2} connectNulls={false} isAnimationActive={false} dot={{ r: 2 }} activeDot={point => <g className="dt-active-point" onClick={() => drill(point.payload)} cursor="pointer"><circle cx={point.cx} cy={point.cy} r={22} fill="transparent" /><circle cx={point.cx} cy={point.cy} r={6} fill="var(--list-action)" pointerEvents="none" /></g>} /></LineChart>
        : <BarChart data={data}>{axes}<Bar dataKey="started_incident_count" name="จำนวนเหตุการณ์" fill="var(--list-action)" radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={row => drill(row)} cursor="pointer" /></BarChart>}
    </ResponsiveContainer></div>
    <details className="dt-chart-data"><summary>ดูข้อมูลกราฟเป็นตาราง / เลือกช่วง</summary><div className="list-table-scroll"><table className="dt-bucket-table"><thead><tr><th>ช่วงเวลา</th><th>เริ่มขัดข้อง</th><th>เวลาสะสม</th><th>ข้อมูล</th><th>รายการ</th></tr></thead><tbody>{data.map(b => <tr key={b.period_start}><td>{b.label}</td><td>{number(b.started_incident_count)}</td><td>{duration(b.duration_in_range_ms)}{!b.duration_is_complete && b.duration_in_range_ms != null ? ' (บางส่วน)' : ''}</td><td>{b.coverage_status === 'future' ? 'ช่วงอนาคต' : b.coverage_status === 'complete' ? 'ครบช่วง' : 'ไม่ยืนยันความครบ'}</td><td><button className="list-button" disabled={!bucketFilter(b, filters, asOf)} onClick={() => drill(b)}>ดูรายการ<span className="list-sr-only"> {b.label}</span></button></td></tr>)}</tbody></table></div></details>
  </section>;
}

export default function DowntimeHistory({ token, onDeviceClick }) {
  const [filters, setFilters] = useState(readFilters);
  const [draft, setDraft] = useState(filters);
  const [formError, setFormError] = useState('');
  const [selectors, setSelectors] = useState({});
  const [selectorRevision, setSelectorRevision] = useState(0);
  const [showTrends, setShowTrends] = useState(true);
  const resources = useDowntime(filters, token);
  const listRef = useRef(null), restored = useRef(false);
  const { summary, dashboard, list } = resources;
  const summaryData = summary.data, dashData = dashboard.data, listData = list.data;
  const meta = summary.meta || list.meta;
  const busy = summary.loading || dashboard.loading || list.loading;
  const navigate = useCallback((next, replace = false) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v !== '') query.set(k, String(v));
    window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', `/downtime-history?${query}`);
    setFilters(next); setDraft(next); setFormError('');
  }, []);
  useEffect(() => {
    const pop = () => { const next = readFilters(); setFilters(next); setDraft(next); setFormError(''); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    request('selectors', null, controller.signal, token).then(result => {
      if (!Array.isArray(result.data.available_years) || !Array.isArray(result.data.provinces)) throw new Error('รูปแบบตัวเลือกไม่ถูกต้อง');
      if (!controller.signal.aborted) setSelectors({ data: result.data });
    }).catch(e => { if (!controller.signal.aborted) setSelectors({ error: e.message }); });
    return () => controller.abort();
  }, [token, selectorRevision]);
  useEffect(() => {
    if (!listData || dashboard.loading || restored.current) return;
    restored.current = true;
    const saved = stored().returnContext;
    if (saved?.url !== `${window.location.pathname}${window.location.search}`) return;
    const frame = requestAnimationFrame(() => { document.getElementById(saved.focus)?.focus({ preventScroll: true }); document.querySelector('.main-content')?.scrollTo(0, Number(saved.mainScroll) || 0); window.scrollTo(0, Number(saved.scroll) || 0); persist({ returnContext: null }); });
    return () => cancelAnimationFrame(frame);
  }, [listData, dashboard.loading]);
  const selectedYear = draft.from.endsWith('-01-01') && draft.to === `${draft.from.slice(0, 4)}-12-31` ? draft.from.slice(0, 4) : '';
  const years = [...new Set([Number(todayThai().slice(0, 4)), Number(draft.from.slice(0, 4)), ...(selectors.data?.available_years || [])])].sort((a, b) => b - a);
  const field = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const fieldClass = key => `list-field${draft[key]?.trim() ? ' is-active' : ''}`;
  const submit = e => { e.preventDefault(); const error = validateFilters(draft); if (error) { setFormError(error); return; } navigate({ ...draft, q: draft.q.trim(), page: 1, bucket_from: '', bucket_to: '' }); };
  const drill = next => { navigate(next); requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })); };
  const deviceLink = (row, id) => row.device_id ? <a id={id} className="list-name" title={name(row)} href={`/device/${encodeURIComponent(row.device_id)}`} onClick={e => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !onDeviceClick) return;
    e.preventDefault(); persist({ returnContext: { url: `${window.location.pathname}${window.location.search}`, scroll: window.scrollY, mainScroll: document.querySelector('.main-content')?.scrollTop, focus: id } }); onDeviceClick(row.device_id);
  }}>{name(row)}</a> : <span className="list-name dt-unlinked" title={name(row)}>{name(row)} <small>(ไม่มีอุปกรณ์เชื่อมโยง)</small></span>;
  const sortHeader = (key, label) => <th aria-sort={filters.sort === key ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="list-sort" disabled={busy} onClick={() => navigate({ ...filters, sort: key, order: filters.sort === key && filters.order === 'asc' ? 'desc' : 'asc', page: 1 })}>{label}{filters.sort === key ? (filters.order === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>;
  const pages = listData?.pagination;
  useEffect(() => {
    if (!pages || filters.page <= Math.max(1, pages.total_pages)) return;
    const task = setTimeout(() => navigate({ ...filters, page: Math.max(1, pages.total_pages) }, true), 0);
    return () => clearTimeout(task);
  }, [pages, filters, navigate]);
  return <div className="list-page dt-page">
    <header className="list-header"><div><h1>ประวัติการขัดข้อง</h1><p>ติดตามเหตุการณ์ ระยะเวลาขัดข้อง และอุปกรณ์ที่ควรตรวจสอบ</p></div><div className="list-actions"><a className="list-button" href="#dt-incidents">ดูรายการ</a><button className="list-button" disabled={busy} onClick={resources.refresh}><RefreshCw size={18} /> รีเฟรชข้อมูล</button></div></header>
    <form className="list-panel dt-filter" onSubmit={submit}><div className="dt-filter-grid">
      <label className={`list-field${selectedYear ? ' is-active' : ''}`}>ปีปฏิทิน<select value={selectedYear} onChange={e => { if (e.target.value) setDraft(prev => ({ ...prev, from: `${e.target.value}-01-01`, to: `${e.target.value}-12-31` })); }}><option value="">กำหนดช่วงวันที่เอง</option>{years.map(y => <option key={y} value={y}>{y + 543} ({y})</option>)}</select></label>
      <label className={fieldClass('from')}>วันที่เริ่ม<input type="date" value={draft.from} onChange={e => field('from', e.target.value)} required /></label>
      <label className={fieldClass('to')}>ถึงวันที่ (รวมทั้งวัน)<input type="date" value={draft.to} onChange={e => field('to', e.target.value)} required /></label>
      <label className={fieldClass('q')}>สำนักงานหรือ IP<input type="search" placeholder="ค้นหาทั้งชุดข้อมูล" value={draft.q} onChange={e => field('q', e.target.value)} /></label>
      <label className={fieldClass('province')}>จังหวัด<select value={draft.province} onChange={e => field('province', e.target.value)}><option value="">ทุกจังหวัด</option>{draft.province && !selectors.data?.provinces.some(p => p.value === draft.province) && <option value={draft.province}>{draft.province}</option>}{selectors.data?.provinces.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      <label className={fieldClass('status')}>สถานะเหตุการณ์<select value={draft.status} onChange={e => field('status', e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className={`list-field${draft.match === 'started' ? ' is-active' : ''}`}>นับเหตุการณ์<select value={draft.match} onChange={e => field('match', e.target.value)}><option value="overlap">ขัดข้องในช่วง (รวมเริ่มก่อนช่วง)</option><option value="started">เริ่มขัดข้องในช่วง</option></select></label>
    </div>{formError && <p className="dt-error" role="alert">{formError}</p>}<div className="dt-form-actions"><button type="submit" className="list-button list-button-primary"><Search size={18} /> ค้นหา</button><button type="button" className="list-button" onClick={() => navigate(defaults())}>ล้างตัวกรอง</button></div>{selectors.error && <p role="alert">โหลดตัวเลือกไม่สำเร็จ <button type="button" className="list-button" onClick={() => setSelectorRevision(v => v + 1)}>ลองโหลดตัวเลือกใหม่</button></p>}</form>
    <div className="dt-scope" aria-live="polite"><p>ผลที่แสดง: {filters.bucket_from || filters.from} ถึง {filters.bucket_to || filters.to} · เวลาไทย · {filters.bucket_from || filters.match === 'started' ? 'เหตุการณ์ที่เริ่มในช่วง' : 'เหตุการณ์ที่ขัดข้องทับช่วง'}</p><div className="dt-chips">{['q', 'province', 'status', 'device_id'].filter(k => filters[k]).map(k => <span key={k}>{({ q: 'คำค้น', province: 'จังหวัด', status: 'สถานะ', device_id: 'รหัสอุปกรณ์' })[k]}: {k === 'status' ? statusLabels[filters[k]] : filters[k]}</span>)}{filters.device_id && <button className="list-button" onClick={() => navigate({ ...filters, device_id: '', page: 1 })}>ล้างอุปกรณ์</button>}{filters.bucket_from && <button className="list-button" onClick={() => navigate({ ...filters, bucket_from: '', bucket_to: '', page: 1 })}>กลับช่วงวันที่เดิม</button>}</div><p>ข้อมูลชุดเดียว ณ {dateTime(meta?.as_of)} · ระยะเวลาของเหตุที่ยังไม่จบคำนวณถึงเวลานี้</p></div>
    <ResourceState resource={summary} retry={resources.retry} label="ยอดสรุป" />
    {summaryData && <><div className="dt-stats"><section className="list-panel dt-panel"><h2>เหตุการณ์ตามตัวกรอง</h2><strong>{number(summaryData.matched_incident_count)} <small>เหตุการณ์</small></strong><p>อุปกรณ์ {number(summaryData.affected_device_count)} เครื่อง · เริ่มในช่วง {number(summaryData.started_incident_count)} เหตุการณ์</p></section><section className="list-panel dt-panel"><h2>ประวัติที่ยังไม่ปิดทั้งระบบ</h2><strong className="dt-danger">{number(summaryData.current_state?.currently_offline_device_count)} <small>อุปกรณ์</small></strong><p>ไม่ใช้ตัวกรองด้านบน · ไม่ใช่ผล ping สด และยังไม่ทราบเวลาอัปเดตต้นทาง</p></section><section className="list-panel dt-panel"><h2>เวลาขัดข้องสะสมในช่วง</h2><strong className="dt-duration">{duration(summaryData.total_duration_in_range_ms)}</strong><p>รวมรายเหตุการณ์ อาจเกินเวลาปฏิทิน{!summaryData.duration_is_complete && ' · คำนวณได้บางส่วน'}</p></section></div><p className="dt-note">ในผลนี้ยังไม่จบ {number(summaryData.open_incident_count)} เหตุการณ์ / {number(summaryData.open_device_count)} อุปกรณ์ · ไม่มีอุปกรณ์เชื่อมโยง {number(summaryData.unlinked_incident_count)} เหตุการณ์</p></>}
    {meta && <aside className="dt-notice">ระบบเริ่มเก็บข้อมูลตั้งแต่ช่วงเดือน พฤษภาคม 2569{Number(meta.data_quality?.invalid_start_record_count) > 0 && ` · ${meta.data_quality.invalid_start_record_count} รายการมีเวลาเริ่มผิดปกติและไม่รวมในผล`}{Number(meta.data_quality?.invalid_interval_record_count) > 0 && ` · ${meta.data_quality.invalid_interval_record_count} รายการมีช่วงเวลาผิดปกติ`}</aside>}
    <button className="list-button dt-toggle" aria-expanded={showTrends} aria-controls="dt-trends" onClick={() => setShowTrends(v => !v)}>{showTrends ? 'พับ' : 'แสดง'}แนวโน้มและอันดับอุปกรณ์</button>
    <div id="dt-trends" hidden={!showTrends}><ResourceState resource={dashboard} retry={resources.retry} label="แนวโน้ม" />{dashData && <><div className="dt-trends-grid"><Trend buckets={dashData.monthly} filters={filters} asOf={dashboard.meta.as_of} onDrill={drill} /><section className="list-panel dt-panel"><h2>อุปกรณ์ที่ควรติดตาม</h2><p className="dt-note">10 อันดับตามจำนวนเหตุการณ์ในผลที่กรอง · เท่ากันเรียงเวลาสะสมมากก่อน</p><ol className="dt-ranking" tabIndex={0} aria-label="อันดับอุปกรณ์ที่ควรติดตาม (เลื่อนดูรายการเพิ่มได้)">{dashData.top_devices.map((row, i) => <li key={row.device_id}><span>{i + 1}</span><div>{deviceLink(row, `dt-top-${row.device_id}`)}<p>{row.province || 'ไม่ทราบจังหวัด'} · {duration(row.total_duration_in_range_ms)}{row.duration_unknown_count > 0 && ' (บางส่วน)'}</p><button className="dt-text-button" onClick={() => drill({ ...filters, device_id: row.device_id, page: 1 })}>ดูเหตุการณ์ของอุปกรณ์นี้</button></div><strong>{number(row.incident_count)} ครั้ง</strong></li>)}</ol>{!dashData.top_devices.length && <p>ไม่มีอุปกรณ์ที่จัดอันดับได้ตามตัวกรอง</p>}</section></div><Trend buckets={dashData.daily} daily filters={filters} asOf={dashboard.meta.as_of} onDrill={drill} /></>}</div>
    <section className="list-panel dt-results" id="dt-incidents" ref={listRef} tabIndex={-1}><div className="dt-panel"><h2>รายการเหตุการณ์</h2><p className="dt-note">สถานะเป็นของเหตุการณ์ในประวัติ ไม่ใช่สถานะปัจจุบันของอุปกรณ์ · เรียงระยะเวลาตามทั้งเหตุการณ์</p></div><ResourceState resource={list} retry={resources.retry} label="รายการ" />
      {listData && <><div className="dt-mobile-sort"><label>เรียงตาม<select value={filters.sort} onChange={e => navigate({ ...filters, sort: e.target.value, page: 1 })}><option value="down_at">เวลาเริ่ม</option><option value="up_at">เวลากลับออนไลน์</option><option value="duration_ms">ระยะเวลาทั้งเหตุการณ์</option><option value="province">จังหวัด</option></select></label><button className="list-button" onClick={() => navigate({ ...filters, order: filters.order === 'asc' ? 'desc' : 'asc', page: 1 })}>{filters.order === 'asc' ? 'น้อยไปมาก ↑' : 'มากไปน้อย ↓'}</button></div>
      {listData.items.length ? <><div className="list-table-scroll dt-desktop">
        <table className="list-table"><thead><tr>
          <th>สำนักงาน</th><th>IP</th>{sortHeader('province', 'จังหวัด')}
          {sortHeader('down_at', 'เริ่มขัดข้อง')}{sortHeader('up_at', 'กลับออนไลน์')}
          {sortHeader('duration_ms', 'ระยะเวลาทั้งเหตุการณ์')}<th>สถานะ</th><th>ข้อมูลเต็ม</th>
        </tr></thead><tbody>{listData.items.map(row => <tr key={row.incident_id}>
          <td>{deviceLink(row, `dt-row-${row.incident_id}`)}</td>
          <td className="list-ip">{row.gateway || '—'}</td><td>{row.province || '—'}</td>
          <td>{dateTime(row.down_at)}</td>
          <td>{row.up_at ? dateTime(row.up_at) : row.status === 'open' ? 'ยังไม่สิ้นสุด' : '—'}</td>
          <td className="dt-numeric">{duration(row.duration_ms)}</td><td><Status value={row.status} /></td>
          <td><details className="dt-record"><summary>ดูข้อมูล<span className="list-sr-only">เหตุการณ์ #{row.incident_id}</span></summary>
            <p>เหตุการณ์ #{row.incident_id} · {name(row)}</p><p>ระยะเวลาในช่วงที่เลือก: {duration(row.duration_in_range_ms)}</p>
          </details></td>
        </tr>)}</tbody></table>
      </div><div className="dt-mobile-list">{listData.items.map(row => <article key={row.incident_id}><header>{deviceLink(row, `dt-mobile-${row.incident_id}`)}<Status value={row.status} /></header><p>{row.gateway || 'ไม่ทราบ IP'} · {row.province || 'ไม่ทราบจังหวัด'}</p><dl><dt>เริ่มขัดข้อง</dt><dd>{dateTime(row.down_at)}</dd><dt>กลับออนไลน์</dt><dd>{row.up_at ? dateTime(row.up_at) : row.status === 'open' ? 'ยังไม่สิ้นสุด' : '—'}</dd><dt>ทั้งเหตุการณ์</dt><dd>{duration(row.duration_ms)}</dd><dt>ในช่วงที่เลือก</dt><dd>{duration(row.duration_in_range_ms)}</dd></dl><small>เหตุการณ์ #{row.incident_id}</small></article>)}</div></> : <div className="dt-empty"><p>{pages.total_items ? 'หน้านี้ไม่มีรายการ กรุณากลับหน้าที่มีข้อมูล' : 'ไม่พบเหตุการณ์ตามช่วงเวลาและตัวกรองนี้'}</p><button className="list-button" onClick={() => navigate(pages.total_items ? { ...filters, page: Math.max(1, pages.total_pages) } : defaults())}>{pages.total_items ? 'ไปหน้าสุดท้าย' : 'ล้างตัวกรอง'}</button></div>}
      <footer className="list-footer"><span>{listData.items.length ? `${(pages.page - 1) * pages.page_size + 1}–${(pages.page - 1) * pages.page_size + listData.items.length}` : '0'} จาก {number(pages.total_items)} รายการ · 15 รายการต่อหน้า</span><div className="list-pagination"><button className="list-button" disabled={filters.page <= 1 || busy} onClick={() => navigate({ ...filters, page: filters.page - 1 })}><ChevronLeft size={18} /> ก่อนหน้า</button><label>หน้า<input aria-label="ไปหน้าที่" type="number" min="1" max={Math.max(1, pages.total_pages)} key={filters.page} defaultValue={filters.page} disabled={!pages.total_pages || busy} onKeyDown={e => { if (e.key === 'Enter') { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= pages.total_pages) navigate({ ...filters, page: value }); } }} /> / {number(pages.total_pages)}</label><button className="list-button" disabled={filters.page >= pages.total_pages || busy} onClick={() => navigate({ ...filters, page: filters.page + 1 })}>ถัดไป <ChevronRight size={18} /></button></div></footer></>}
    </section>
  </div>;
}
