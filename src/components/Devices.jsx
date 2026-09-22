import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './Devices.css';

const VIEW_KEY = 'network-devices:view:v1';
const readView = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY)) || {};
    return {
      searchTerm: typeof saved.searchTerm === 'string' ? saved.searchTerm : '',
      selectedType: typeof saved.selectedType === 'string' ? saved.selectedType : 'All',
      currentPage: Number.isSafeInteger(saved.currentPage) && saved.currentPage > 0 ? saved.currentPage : 1,
      itemsPerPage: [10, 25, 50, 100].includes(saved.itemsPerPage) ? saved.itemsPerPage : 10,
      sortConfig: ['pea_name', 'province', 'gateway', 'latency_ms', 'packet_loss', 'status'].includes(saved.sortConfig?.key) && ['asc', 'desc'].includes(saved.sortConfig?.direction) ? saved.sortConfig : { key: null, direction: 'asc' },
    };
  } catch { return {}; }
};

const Devices = ({ onDeviceClick, user }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedView] = useState(readView);
  const [searchTerm, setSearchTerm] = useState(savedView.searchTerm || '');
  const [currentPage, setCurrentPage] = useState(savedView.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(savedView.itemsPerPage || 10);
  const [sortConfig, setSortConfig] = useState(savedView.sortConfig || { key: null, direction: 'asc' });
  const [selectedType, setSelectedType] = useState(savedView.selectedType || 'All');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({ searchTerm, currentPage, itemsPerPage, sortConfig, selectedType }));
    } catch { /* Browsing still works when browser storage is unavailable. */ }
  }, [searchTerm, currentPage, itemsPerPage, sortConfig, selectedType]);
  const peaTypes = React.useMemo(() => {
    const types = new Set();
    devices.forEach(d => {
      if (d.device?.pea_type) types.add(d.device.pea_type);
      else if (d.pea_type) types.add(d.pea_type);
    });
    return ['All', ...Array.from(types).sort()];
  }, [devices]);

  const fetchDevices = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/metrics`, { signal: controller.signal });
      if (!response.ok) throw new Error('Unable to load devices');
      const result = await response.json();
      if (result.success === false || !Array.isArray(result.data)) throw new Error('Invalid device response');
      if (requestRef.current !== controller) return;
      setDevices(result.data);
      setLastUpdated(new Date());
      setError('');
    } catch {
      if (requestRef.current === controller) setError('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้ กรุณาลองใหม่');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => {
      clearInterval(interval);
      const controller = requestRef.current;
      requestRef.current = null;
      controller?.abort();
    };
  }, [fetchDevices]);

  const filteredDevices = devices.filter(d => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = [d.device?.pea_name, d.device?.province, d.device?.gateway, d.status]
      .some(value => String(value || '').toLowerCase().includes(query));
    
    const dType = d.device?.pea_type || d.pea_type;
    const matchesType = selectedType === 'All' || dType === selectedType;
    
    return matchesSearch && matchesType;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
      key = null;
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortedDevices = React.useMemo(() => {
    if (!sortConfig.key) {
      // Default order: same order the API sent (by id), but devices that are
      // currently down bubble up to the top so they're easy to spot first.
      return [...filteredDevices].sort((a, b) => {
        const aDown = a.status === 'down' ? 0 : 1;
        const bDown = b.status === 'down' ? 0 : 1;
        if (aDown !== bDown) return aDown - bDown;
        return (a.id ?? 0) - (b.id ?? 0);
      });
    }

    return [...filteredDevices].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'pea_name':
          aValue = (a.device?.pea_name || '').toLowerCase();
          bValue = (b.device?.pea_name || '').toLowerCase();
          break;
        case 'province':
          aValue = (a.device?.province || '').toLowerCase();
          bValue = (b.device?.province || '').toLowerCase();
          break;
        case 'gateway':
          aValue = a.device?.gateway || '';
          bValue = b.device?.gateway || '';
          break;
        case 'latency_ms':
          aValue = a.latency_ms ?? Infinity;
          bValue = b.latency_ms ?? Infinity;
          break;
        case 'packet_loss':
          aValue = a.packet_loss ?? 0;
          bValue = b.packet_loss ?? 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDevices, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedDevices.length / itemsPerPage));
  // Clamp only the displayed page: keep the saved page during initial loading.
  const visiblePage = Math.min(currentPage, totalPages);
  const indexOfFirstItem = (visiblePage - 1) * itemsPerPage;
  const currentItems = sortedDevices.slice(indexOfFirstItem, indexOfFirstItem + itemsPerPage);
  const hasFilters = Boolean(searchTerm || selectedType !== 'All');
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('All');
    setCurrentPage(1);
  };
  const columns = [
    ['pea_name', 'สำนักงาน'], ['province', 'จังหวัด'], ['gateway', 'Gateway IP'],
    ['latency_ms', 'Latency (ms)'], ['packet_loss', 'Packet loss (%)'], ['status', 'สถานะ'],
  ];

  // Exports every device fetched for this page, not just whatever the
  // current search/type filter or page happens to show on screen.
  const exportToExcel = () => {
    if (devices.length === 0) {
      toast.error('ไม่มีข้อมูลอุปกรณ์สำหรับส่งออก');
      return;
    }
    const rows = devices.map(d => ({
      'PEA Name': d.device?.pea_name || '-',
      'Province': d.device?.province || '-',
      // Same protection as the blurred on-screen column -- IP only goes into
      // the export for logged-in users.
      'Gateway IP': user ? (d.device?.gateway || '-') : 'เข้าสู่ระบบเพื่อดู',
      'Latency (ms)': Number.isFinite(d.latency_ms) ? d.latency_ms.toFixed(2) : '-',
      'Packet Loss (%)': d.packet_loss ?? '-',
      'Status': d.status || '-'
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Devices');
    XLSX.writeFile(workbook, `Network_Devices_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`ส่งออก Excel สำเร็จ (${rows.length} รายการ)`);
  };

  return (
    <div className="list-page devices-page">
      <header className="list-header">
        <div>
          <h1>อุปกรณ์เครือข่าย</h1>
          <p>ตรวจสอบสถานะการเชื่อมต่อของสำนักงาน · อัปเดตอัตโนมัติทุก 1 นาที</p>
        </div>
        <div className="list-actions">
          <button className="list-button" onClick={fetchDevices} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'กำลังโหลด' : 'รีเฟรช'}
          </button>
          <button className="list-button list-button-primary" onClick={exportToExcel} disabled={!devices.length}>
            <FileSpreadsheet size={18} aria-hidden="true" /> ส่งออกทั้งหมด (Excel)
          </button>
        </div>
      </header>

      {error && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{error}</strong>{lastUpdated && <p>กำลังแสดงข้อมูลจากการอัปเดตครั้งก่อน สถานะอาจเปลี่ยนแปลงแล้ว</p>}</div>
          <button className="list-button" onClick={fetchDevices} disabled={loading}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายการอุปกรณ์เครือข่าย">
        <div className="list-toolbar">
          <label className="list-field list-search">
            <span>ค้นหาอุปกรณ์</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่อสำนักงาน จังหวัด IP หรือ up / down" value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
          </label>
          <label className="list-field">
            <span>ประเภทสำนักงาน</span>
            <select value={selectedType} onChange={e => { setSelectedType(e.target.value); setCurrentPage(1); }}>
              {selectedType !== 'All' && !peaTypes.includes(selectedType) && <option value={selectedType}>{selectedType}</option>}
              {peaTypes.map(type => <option key={type} value={type}>{type === 'All' ? 'ทุกประเภท' : type}</option>)}
            </select>
          </label>
          <button className="list-button" onClick={clearFilters} disabled={!hasFilters}>ล้างตัวกรอง</button>
        </div>

        <div className="list-result-info">
          <span role="status">{lastUpdated ? `พบ ${sortedDevices.length.toLocaleString('th-TH')} จาก ${devices.length.toLocaleString('th-TH')} รายการ` : loading ? 'กำลังโหลดรายการอุปกรณ์…' : 'ยังไม่มีข้อมูลที่โหลดสำเร็จ'}</span>
          <span>{lastUpdated && `อัปเดตล่าสุด ${lastUpdated.toLocaleTimeString('th-TH')}`}{!sortConfig.key && ' · แสดงอุปกรณ์ที่ขัดข้องก่อน'}</span>
        </div>
        <div id="devices-table-container" className="list-table-scroll" role="region" aria-label="ตารางอุปกรณ์ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" tabIndex={0} aria-busy={loading}>
          <table className="list-table">
            <caption className="list-sr-only">อุปกรณ์เครือข่าย กดชื่อสำนักงานเพื่อเปิดรายละเอียด</caption>
            <thead><tr>
              <th scope="col">ลำดับ</th>
              {columns.map(([key, label]) => (
                <th key={key} scope="col" aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button className="list-sort" onClick={() => requestSort(key)}>
                    {label}
                    {sortConfig.key === key ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" />}
                  </button>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {!lastUpdated ? (
                <tr><td colSpan={7} className="list-empty">{loading ? 'กำลังโหลดข้อมูลอุปกรณ์…' : 'โหลดข้อมูลไม่สำเร็จ กด “ลองใหม่” เพื่อโหลดอีกครั้ง'}</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={7} className="list-empty">
                  <strong>{hasFilters ? 'ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง' : 'ยังไม่มีอุปกรณ์ในระบบ'}</strong>
                  <p>{hasFilters ? 'ลองเปลี่ยนคำค้น หรือเลือกประเภทสำนักงานอื่น' : 'รายการจะแสดงเมื่อมีข้อมูลอุปกรณ์'}</p>
                  {hasFilters && <button className="list-button" onClick={clearFilters}>ล้างตัวกรอง</button>}
                </td></tr>
              ) : currentItems.map((d, index) => (
                <tr key={d.id} className={d.status === 'down' ? 'list-row-down' : ''}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td><a className="list-name" title={d.device?.pea_name || 'ดูรายละเอียดอุปกรณ์'} href={`/device/${d.device_id || d.id}`} onClick={e => {
                    if (onDeviceClick && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      onDeviceClick(d.device_id || d.id);
                    }
                  }}>{d.device?.pea_name || 'ดูรายละเอียดอุปกรณ์'}</a></td>
                  <td>{d.device?.province || '—'}</td>
                  <td className={user ? 'list-ip' : 'list-muted'}>{user ? (d.device?.gateway || '—') : 'เข้าสู่ระบบเพื่อดู IP'}</td>
                  <td className="list-number">{Number.isFinite(d.latency_ms) ? d.latency_ms.toFixed(2) : '—'}</td>
                  <td className="list-number">{d.packet_loss ?? '—'}</td>
                  <td><span className={`list-status list-status-${d.status === 'up' ? 'up' : d.status === 'down' ? 'down' : 'unknown'}`}>
                    {d.status === 'up' ? <CheckCircle size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
                    {d.status === 'up' ? 'ออนไลน์' : d.status === 'down' ? 'ขัดข้อง' : 'ไม่ทราบสถานะ'}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="list-footer">
          <label className="list-page-size">แสดง
            <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>รายการต่อหน้า
          </label>
          <span className="list-muted">{sortedDevices.length ? `${indexOfFirstItem + 1}–${Math.min(indexOfFirstItem + itemsPerPage, sortedDevices.length)} จาก ${sortedDevices.length}` : '0 รายการ'}</span>
          <nav className="list-pagination" aria-label="แบ่งหน้ารายการอุปกรณ์">
            <button className="list-button" disabled={visiblePage === 1 || !lastUpdated} onClick={() => setCurrentPage(visiblePage - 1)}>ก่อนหน้า</button>
            <label>หน้า <select value={visiblePage} onChange={e => setCurrentPage(Number(e.target.value))} disabled={!lastUpdated}>
              {Array.from({ length: totalPages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select> / {totalPages}</label>
            <button className="list-button" disabled={visiblePage === totalPages || !lastUpdated} onClick={() => setCurrentPage(visiblePage + 1)}>ถัดไป</button>
          </nav>
        </footer>
      </section>
    </div>
  );
};

export default Devices;
