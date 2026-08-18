import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Search, RefreshCw, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const Devices = ({ onDeviceClick, user }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedType, setSelectedType] = useState('All');
  const peaTypes = React.useMemo(() => {
    const types = new Set();
    devices.forEach(d => {
      if (d.device?.pea_type) types.add(d.device.pea_type);
      else if (d.pea_type) types.add(d.pea_type);
    });
    return ['All', ...Array.from(types).sort()];
  }, [devices]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/metrics`);
      const result = await response.json();
      setDevices(result.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.device?.pea_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.device?.gateway?.includes(searchTerm) ||
      d.status?.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedDevices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedDevices.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
      'Latency (ms)': d.latency_ms != null ? d.latency_ms.toFixed(2) : '-',
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="devices-page"
    >
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>รายการอุปกรณ์เครือข่ายภายในสำนักงาน</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>รายละเอียดอุปกรณ์เครือข่ายภายในหลักของสำนักงาน (Auto-refreshes every minute).</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={exportToExcel}
            className="glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.6rem 1.2rem',
              gap: '0.5rem',
              borderRadius: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)'
            }}
          >
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            background: selectedType !== 'All' ? 'var(--bg-accent-subtle)' : 'var(--input-bg)',
            border: selectedType !== 'All' ? '1px solid var(--accent-primary)' : '1px solid var(--input-border)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                paddingRight: '1.5rem',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
                backgroundSize: '1rem'
              }}
            >
              {peaTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 700,
                paddingRight: '1.5rem',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
                backgroundSize: '1rem'
              }}
            >
              <option value="10" style={{ background: '#ffffff', color: '#0f172a' }}>10</option>
              <option value="25" style={{ background: '#ffffff', color: '#0f172a' }}>25</option>
              <option value="50" style={{ background: '#ffffff', color: '#0f172a' }}>50</option>
              <option value="100" style={{ background: '#ffffff', color: '#0f172a' }}>100</option>
            </select>
          </div>
          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem', borderRadius: '0.5rem',
            background: searchTerm ? 'var(--bg-accent-subtle)' : 'var(--input-bg)',
            border: searchTerm ? '1px solid var(--accent-primary)' : '1px solid var(--input-border)'
          }}>
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="ค้นหาอุปกรณ์..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
            />
          </div>
        </div>
      </header>

      <div id="devices-table-container" className="card glass" style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem', borderRadius: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <th style={{ padding: '1.25rem 1.5rem', width: '60px' }}>No.</th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('pea_name')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  PEA Name {sortConfig.key === 'pea_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('province')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Province {sortConfig.key === 'province' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('gateway')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Gateway IP {sortConfig.key === 'gateway' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('latency_ms')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Latency (ms) {sortConfig.key === 'latency_ms' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('packet_loss')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Packet Loss {sortConfig.key === 'packet_loss' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
              <th 
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => requestSort('status')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading devices...</td></tr>
            ) : currentItems.map((d, index) => (
              <tr
                key={d.id}
                onClick={() => onDeviceClick && onDeviceClick(d.device_id || d.id)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                className="table-row-hover"
              >
                <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {indexOfFirstItem + index + 1}
                </td>
                <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{d.device?.pea_name || '-'}</td>
                <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>{d.device?.province || '-'}</td>
                <td style={{ 
                  padding: '1.25rem 1.5rem', 
                  fontFamily: 'ui-monospace', 
                  fontSize: '0.9rem',
                  filter: !user ? 'blur(4px)' : 'none',
                  transition: 'filter 0.3s ease',
                  userSelect: !user ? 'none' : 'auto'
                }}>{d.device?.gateway || '-'}</td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <span style={{
                    color: (d.latency_ms === null || d.status === 'down') ? 'var(--accent-danger)' : d.latency_ms > 150 ? 'var(--accent-danger)' : d.latency_ms > 80 ? 'var(--accent-warning)' : 'var(--accent-success)',
                    fontWeight: 600
                  }}>
                    {d.latency_ms !== null ? `${d.latency_ms.toFixed(2)} ms` : 'N/A'}
                  </span>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', minWidth: '60px' }}>
                      <div style={{
                        width: `${Math.min(d.packet_loss || 0, 100)}%`,
                        height: '100%',
                        background: (d.packet_loss || 0) > 5 || d.status === 'down' ? 'var(--accent-danger)' : 'var(--accent-success)',
                        borderRadius: '2px'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8rem' }}>{d.packet_loss || 0}%</span>
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: d.status === 'up' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    color: d.status === 'up' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {d.status === 'up' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                    {d.status}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => paginate(currentPage - 1)}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentPage === 1 ? 0.3 : 1 }}
          >
            Prev
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.9rem' }}>Go to:</span>
            <select
              value={currentPage}
              onChange={(e) => paginate(Number(e.target.value))}
              style={{
                background: 'var(--input-bg)',
                color: '#0f172a',
                border: '1px solid var(--input-border)',
                padding: '0.4rem 1.8rem 0.4rem 0.8rem',
                borderRadius: '0.5rem',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1rem'
              }}
            >
              {[...Array(totalPages).keys()].map(n => (
                <option key={n + 1} value={n + 1} style={{ background: '#ffffff', color: '#0f172a' }}>
                  Page {n + 1}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.9rem' }}>of {totalPages}</span>
          </div>
          <button
            disabled={currentPage === totalPages}
            onClick={() => paginate(currentPage + 1)}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentPage === totalPages ? 0.3 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Devices;
