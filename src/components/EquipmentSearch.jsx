import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Loader2, RefreshCw, ChevronDown, SlidersHorizontal, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import './ListPage.css';
import './EquipmentSearch.css';
import SearchableDropdown from './SearchableDropdown';

// Same fixed option lists EquipmentBorrow.jsx uses, duplicated here since
// they aren't exported from that file.
const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];
const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย', 'ถูกยืม', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน'];

// Advanced (less commonly used) text filters -- sent as-is in the POST body,
// substring-matched server-side. Kept separate from the primary filter row
// so the common case (name/type/department/status/site) doesn't get
// crowded out by long-tail fields like MAC address or contract number.
const ADVANCED_FIELDS = [
  { key: 'vendor', label: 'ผู้ผลิต/ตัวแทนจำหน่าย' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_number', label: 'รหัสทรัพย์สิน' },
  { key: 'asset_owner', label: 'ผู้ถือครอง' },
  { key: 'asset_owner_emp_id', label: 'รหัสพนักงานผู้ถือครอง' },
  { key: 'storage_location', label: 'สถานที่จัดเก็บ' },
  { key: 'ip_address', label: 'IP Address' },
  { key: 'mac_address', label: 'MAC Address' },
  { key: 'contract_no', label: 'เลขที่สัญญา' },
  { key: 'notes', label: 'หมายเหตุ' }
];

const buildImageUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;


const emptyPrimary = { equipment_type: '', department: '', status: '' };
const emptyAdvanced = Object.fromEntries(ADVANCED_FIELDS.map(({ key }) => [key, '']));
const read = (key, fallback = '') => {
  try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ }
};
const readFields = (key, defaults) => {
  try {
    const value = JSON.parse(read(key, '{}'));
    return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, typeof value?.[k] === 'string' ? value[k] : v]));
  } catch { return defaults; }
};
const readPage = () => {
  const page = Number(read('eq_search_page', '1'));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};
const siteLabel = s => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;
const statusTone = status => {
  if (status === 'ใช้งาน') return 'up';
  if (['รอปรับปรุง', 'รอจำหน่าย', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน'].includes(status)) return 'warning';
  if (['เลิกใช้งาน', 'จำหน่าย'].includes(status)) return 'down';
  if (status === 'ถูกยืม') return 'borrowed';
  return 'unknown';
};
const PRIMARY_FIELDS = [
  ['equipment_type', 'ประเภทอุปกรณ์', EQUIPMENT_TYPE_OPTIONS],
  ['department', 'แผนก', DEPARTMENT_OPTIONS],
  ['status', 'สถานะ', STATUS_OPTIONS],
];

const EquipmentSearch = ({ token, onEquipmentClick }) => {
  const [inputs, setInputs] = useState(() => ({
    name: read('eq_search_name'), site: read('eq_search_site_input'),
    primary: readFields('eq_search_primary', emptyPrimary),
    advanced: readFields('eq_search_advanced', emptyAdvanced),
  }));
  const [filters, setFilters] = useState(inputs);
  const [currentPage, setCurrentPage] = useState(readPage);
  const itemsPerPage = 10;
  const [showAdvanced, setShowAdvanced] = useState(() => read('eq_search_show_advanced') === '1');
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState(false);
  const [siteRetry, setSiteRetry] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    save('eq_search_name', inputs.name);
    save('eq_search_site_input', inputs.site);
    save('eq_search_primary', JSON.stringify(inputs.primary));
    save('eq_search_advanced', JSON.stringify(inputs.advanced));
  }, [inputs]);
  useEffect(() => { save('eq_search_page', String(currentPage)); }, [currentPage]);
  useEffect(() => { save('eq_search_show_advanced', showAdvanced ? '1' : '0'); }, [showAdvanced]);
  useEffect(() => {
    if (inputs === filters) return;
    const timer = setTimeout(() => { setFilters(inputs); setCurrentPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [inputs, filters]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setSitesLoading(true);
      setSitesError(false);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const list = data.data || data;
        if (!Array.isArray(list)) throw new Error();
        if (active) setSites(list);
      } catch { if (active) setSitesError(true); }
      finally { clearTimeout(timer); if (active) setSitesLoading(false); }
    };
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [token, siteRetry]);

  const site = sites.find(s => siteLabel(s) === filters.site);
  const siteInputMatches = sites.some(s => siteLabel(s) === inputs.site);
  const waitingForSite = Boolean(filters.site && sitesLoading);
  const body = useMemo(() => {
    const next = { page: currentPage, limit: itemsPerPage };
    if (filters.name.trim()) next.name = filters.name.trim();
    for (const [key, value] of Object.entries({ ...filters.primary, ...filters.advanced })) {
      if (value.trim()) next[key] = value.trim();
    }
    if (site) next.pea_site_id = Number(site.id);
    return next;
  }, [filters, currentPage, site]);
  const requestKey = JSON.stringify(body);
  const pending = inputs !== filters || waitingForSite || loading || result?.key !== requestKey || result?.token !== token;

  useEffect(() => {
    if (waitingForSite) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    const search = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: requestKey, signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data)) throw new Error();
        if (!active) return;
        const total = Number(data.pagination?.total ?? data.data.length);
        const totalPages = Math.max(1, Number(data.pagination?.totalPages) || Math.ceil(total / itemsPerPage));
        if (currentPage > totalPages) { setCurrentPage(totalPages); return; }
        setResult({ equipment: data.data, total, totalPages, page: currentPage, key: requestKey, token, updated: new Date() });
      } catch { if (active) setError('ไม่สามารถค้นหาอุปกรณ์ได้ กรุณาลองใหม่'); }
      finally { clearTimeout(timer); if (active) setLoading(false); }
    };
    search();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [requestKey, token, retry, waitingForSite, currentPage]);

  // Only show rows for this page's filters and current authorization context.
  const shown = result?.key === requestKey && result?.token === token ? result : null;
  const advancedActiveCount = Object.values(inputs.advanced).filter(value => value.trim()).length;
  const anyFilterActive = Boolean(inputs.name || inputs.site || Object.values(inputs.primary).some(Boolean) || advancedActiveCount);
  const change = (key, value) => setInputs(prev => ({ ...prev, [key]: value }));
  const changeField = (group, key, value) => setInputs(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const clearAllFilters = () => {
    const cleared = { name: '', site: '', primary: emptyPrimary, advanced: emptyAdvanced };
    setInputs(cleared); setFilters(cleared); setCurrentPage(1);
  };

  const exportToExcel = async () => {
    if (pending || error || !shown?.total || exportingExcel) return;
    setExportingExcel(true);
    try {
      // Follow server pagination: do not silently truncate at a high limit.
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/search`, {
          method: 'POST', signal: AbortSignal.timeout(30000),
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ ...body, page, limit: itemsPerPage }),
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.success || !Array.isArray(data.data) || !data.data.length) throw new Error();
        all.push(...data.data);
        totalPages = Math.max(1, Number(data.pagination?.totalPages) || Math.ceil(Number(data.pagination?.total ?? shown.total) / itemsPerPage));
        page += 1;
      } while (page <= totalPages);
      const result = { data: all };
      const rows = result.data.map(item => ({
        'ชื่ออุปกรณ์': item.name || '-',
        'ประเภทอุปกรณ์': item.equipment_type || '-',
        'แผนก': item.department || '-',
        'สถานะ': item.status || '-',
        'สำนักงาน': item.pea_site ? `${item.pea_site.pea_name}${item.pea_site.pea_province ? ` (${item.pea_site.pea_province})` : ''}` : '-',
        'IP Address': item.ip_address || '-',
        'MAC Address': item.mac_address || '-',
        'ผู้ขาย': item.vendor || '-',
        'เลขที่สัญญา': item.contract_no || '-',
        'วันเริ่มสัญญา': item.contract_start_date || '-',
        'วันหมดอายุสัญญา': item.contract_expiry_date || '-',
        'Serial Number': item.serial_number || '-',
        'รหัสทรัพย์สิน': item.asset_number || '-',
        'ผู้ถือครอง': item.asset_owner || '-',
        'รหัสพนักงานผู้ถือครอง': item.asset_owner_emp_id || '-',
        'สถานที่ติดตั้งหรือจัดเก็บ': item.storage_location || '-',
        'หมายเหตุ': item.notes || '-'
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'อุปกรณ์');
      XLSX.writeFile(workbook, `Equipment_Search_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`ส่งออก Excel สำเร็จ (${rows.length} รายการ)`);
    } catch {
      toast.error('ส่งออกไม่สำเร็จ กรุณาลองใหม่');
    } finally { setExportingExcel(false); }
  };

  return (
    <div className="list-page equipment-search-page">
      <header className="list-header">
        <div><h1>ค้นหาอุปกรณ์คอมพิวเตอร์</h1><p>ค้นหาด้วยชื่ออุปกรณ์ หรือกรองตามสำนักงาน รหัสทรัพย์สิน และรายละเอียดอื่น ๆ</p></div>
        <div className="list-actions">
          <button className="list-button" disabled={loading || waitingForSite} onClick={() => setRetry(n => n + 1)}><RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />รีเฟรช</button>
          <button className="list-button list-button-primary" disabled={pending || Boolean(error) || !shown?.total || exportingExcel} onClick={exportToExcel}>
            {exportingExcel ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={18} aria-hidden="true" />}
            {exportingExcel ? 'กำลังส่งออก…' : 'ส่งออกผลการค้นหา (Excel)'}
          </button>
        </div>
      </header>
      {error && <div className="list-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>{error}</strong>{shown && <p>แสดงผลจากการค้นหาครั้งก่อน ข้อมูลอาจเปลี่ยนแปลงแล้ว</p>}</div><button className="list-button" disabled={loading} onClick={() => setRetry(n => n + 1)}>ลองใหม่</button></div>}
      <section className="list-panel" aria-label="ค้นหาและกรองอุปกรณ์">
        <div className="equipment-filters">
          <label className="list-field equipment-name-filter"><span>ชื่ออุปกรณ์</span><div className="list-search-input"><Search size={18} aria-hidden="true" /><input type="search" placeholder="พิมพ์ชื่ออุปกรณ์" value={inputs.name} onChange={e => change('name', e.target.value)} /></div></label>
          {PRIMARY_FIELDS.map(([key, label, options]) => <label className="list-field" key={key}><span>{label}</span><SearchableDropdown label={label} placeholder="ทั้งหมด" value={inputs.primary[key]} onChange={value => changeField('primary', key, value)} options={options} /></label>)}
          <label className="list-field equipment-site-filter"><span>สำนักงาน</span><SearchableDropdown label="สำนักงาน" placeholder={sitesLoading ? 'กำลังโหลดสำนักงาน…' : 'พิมพ์แล้วเลือกสำนักงาน'} value={inputs.site} onChange={value => change('site', value)} describedBy="equipment-site-help" options={[...new Set(sites.map(siteLabel))]} /></label>
        </div>
        <div className="equipment-filter-help" id="equipment-site-help">
          {sitesError ? <span role="alert">โหลดรายชื่อสำนักงานไม่สำเร็จ <button className="list-button" onClick={() => setSiteRetry(n => n + 1)}>โหลดสำนักงานใหม่</button></span> : inputs.site && !siteInputMatches && !sitesLoading ? <span className="list-filter-warning">ยังไม่ได้กรองสำนักงาน กรุณาเลือกชื่อให้ตรงกับรายการแนะนำ</span> : 'สำนักงานต้องเลือกชื่อให้ตรงกับรายการแนะนำ ส่วนตัวกรองอื่นพิมพ์บางส่วนได้'}
        </div>
        <div className="equipment-filter-actions">
          <button className="list-button" aria-expanded={showAdvanced} aria-controls="equipment-advanced" onClick={() => setShowAdvanced(value => !value)}><SlidersHorizontal size={18} aria-hidden="true" />ตัวกรองขั้นสูง{advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ''}<ChevronDown size={16} aria-hidden="true" style={{ transform: showAdvanced ? 'rotate(180deg)' : undefined }} /></button>
          <button className="list-button" disabled={!anyFilterActive} onClick={clearAllFilters}>ล้างตัวกรอง</button>
          <span className="list-muted">ค้นหาอัตโนมัติ · ใช้ทุกเงื่อนไขร่วมกัน</span>
        </div>
        <div id="equipment-advanced" className="equipment-advanced" hidden={!showAdvanced}>
          {ADVANCED_FIELDS.map(({ key, label }) => <label className="list-field" key={key}><span>{label}</span><input value={inputs.advanced[key]} onChange={e => changeField('advanced', key, e.target.value)} /></label>)}
        </div>
        <div className="list-result-info"><span role="status">{error ? 'ค้นหาไม่สำเร็จ' : pending ? 'กำลังค้นหา…' : `พบ ${shown?.total.toLocaleString('th-TH') ?? 0} รายการ`}</span><span>{shown && `อัปเดตล่าสุด ${shown.updated.toLocaleTimeString('th-TH')}`}</span></div>
        {!shown || !shown.equipment.length ? <div className="equipment-empty">
          <strong>{error ? 'ไม่สามารถแสดงผลการค้นหาล่าสุด' : pending ? 'กำลังค้นหาอุปกรณ์…' : anyFilterActive ? 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง' : 'ยังไม่มีอุปกรณ์ในระบบ'}</strong>
          {!pending && !error && anyFilterActive && <><p>ลองเปลี่ยนคำค้น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p><button className="list-button" onClick={clearAllFilters}>ล้างตัวกรอง</button></>}
        </div> : <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางผลการค้นหา เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" aria-busy={pending}>
          <table className="list-table"><caption className="list-sr-only">ผลการค้นหาอุปกรณ์ กดชื่ออุปกรณ์เพื่อเปิดรายละเอียด</caption><thead><tr>{['ชื่ออุปกรณ์', 'ประเภท', 'แผนก', 'สำนักงาน', 'รหัสทรัพย์สิน / Serial', 'ผู้ถือครอง', 'สถานะ'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{shown.equipment.map(item => <tr key={item.id}>
              <td><div className="equipment-name-cell">{item.photos?.[0] && <img src={buildImageUrl(item.photos[0])} alt="" loading="lazy" />}<a className="list-name" title={item.name || 'ดูรายละเอียดอุปกรณ์'} href={`/equipment/${item.id}`} onClick={e => { if (onEquipmentClick && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onEquipmentClick(item.id); } }}>{item.name || 'ดูรายละเอียดอุปกรณ์'}</a></div></td>
              <td title={item.equipment_type || '—'}>{item.equipment_type || '—'}</td>
              <td title={item.department || '—'}>{item.department || '—'}</td>
              <td title={item.pea_site ? siteLabel(item.pea_site) : '—'}>{item.pea_site ? siteLabel(item.pea_site) : '—'}</td>
              <td title={`${item.asset_number || '—'} / Serial: ${item.serial_number || '—'}`}>{item.asset_number || '—'} / <span className="list-muted">Serial: {item.serial_number || '—'}</span></td>
              <td title={[item.asset_owner || '—', item.asset_owner_emp_id].filter(Boolean).join(' · ')}>{item.asset_owner || '—'}{item.asset_owner_emp_id && <span className="list-muted"> · {item.asset_owner_emp_id}</span>}</td>
              <td title={[item.status || 'ไม่ทราบสถานะ', item.current_loan?.borrower_name && `โดย ${item.current_loan.borrower_name}`].filter(Boolean).join(' · ')}><span className={`list-status list-status-${statusTone(item.status)}`}>{item.status || 'ไม่ทราบสถานะ'}</span>{item.current_loan?.borrower_name && <span className="list-muted"> · โดย {item.current_loan.borrower_name}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <footer className="list-footer"><span className="list-muted">{shown?.total ? `${(shown.page - 1) * itemsPerPage + 1}–${(shown.page - 1) * itemsPerPage + shown.equipment.length} จาก ${shown.total} รายการ` : '—'} · {itemsPerPage} รายการต่อหน้า</span>
          <nav className="list-pagination" aria-label="แบ่งหน้าผลการค้นหา"><button className="list-button" disabled={pending || Boolean(error) || currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>ก่อนหน้า</button><label>หน้า <select value={shown?.page || currentPage} disabled={pending || Boolean(error)} onChange={e => setCurrentPage(Number(e.target.value))}>{Array.from({ length: Math.max(currentPage, shown?.totalPages || 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select> / {shown?.totalPages || '—'}</label><button className="list-button" disabled={pending || Boolean(error) || !shown || currentPage >= shown.totalPages} onClick={() => setCurrentPage(p => p + 1)}>ถัดไป</button></nav>
        </footer>
      </section>
    </div>
  );
};

export default EquipmentSearch;
