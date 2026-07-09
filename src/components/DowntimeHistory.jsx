import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Activity, AlertCircle, Clock, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const DowntimeHistory = ({ token }) => {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [selectedProvince, setSelectedProvince] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'down_at', direction: 'desc' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const [summaryRes, logsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/summary`, { headers }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/all`, { headers })
        ]);

        const summaryData = await summaryRes.json();
        const logsData = await logsRes.json();

        if (summaryData.success) setSummary(summaryData.data);
        if (logsData.success) setLogs(logsData.data || []);
      } catch (error) {
        console.error('Error fetching downtime history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const provinces = React.useMemo(() => {
    const pSet = new Set();
    logs.forEach(log => {
      const p = log.province || log.device?.province;
      if (p) pSet.add(p);
    });
    return ['All', ...Array.from(pSet).sort()];
  }, [logs]);

  const formatDuration = (durationStr) => {
    if (!durationStr) return '-';
    // Handle format Days:Hours:Minutes:Seconds
    const parts = durationStr.split(':').map(Number);
    if (parts.length !== 4) return durationStr;
    const [d, h, m, s] = parts;
    const result = [];
    if (d > 0) result.push(`${d} วัน`);
    if (h > 0) result.push(`${h} ชั่วโมง`);
    if (m > 0) result.push(`${m} นาที`);
    if (s > 0) result.push(`${s} วินาที`);
    return result.length > 0 ? result.join(' ') : '-';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.device?.pea_name || log.pea_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.status || '').toLowerCase().includes(searchTerm.toLowerCase());
    const p = log.province || log.device?.province;
    const matchesProvince = selectedProvince === 'All' || p === selectedProvince;
    return matchesSearch && matchesProvince;
  });

  const sortedLogs = React.useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === 'province') {
        aVal = a.province || a.device?.province || '';
        bVal = b.province || b.device?.province || '';
      } else if (sortConfig.key === 'down_at') {
        aVal = new Date(a.down_at).getTime();
        bVal = new Date(b.down_at).getTime();
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortConfig]);

  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const currentLogs = sortedLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ color: 'var(--accent-primary)' }}
        >
          <Activity size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="downtime-history-page"
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>ประวัติการขัดข้อง (Downtime History)</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>สรุปรายการและประวัติการขัดข้องของอุปกรณ์เครือข่ายทั้งหมดในระบบ</p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>เหตุการณ์ทั้งหมด</span>
            <div style={{ color: 'var(--accent-primary)', background: 'var(--bg-accent-subtle)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <History size={20} />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700 }}>{summary?.total_incidents || 0}</span>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>รายการทั้งหมดในประวัติ</p>
          </div>
        </div>

        <div className="card glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>กำลังขัดข้อง (Current Down Devices)</span>
            <div style={{ color: 'var(--accent-danger)', background: 'var(--bg-danger-subtle)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-danger)' }}>{summary?.currently_offline_count || 0}</span>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>อุปกรณ์ที่ยังไม่ออนไลน์</p>
          </div>
        </div>

        <div className="card glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>เวลารวมที่ขัดข้อง</span>
            <div style={{ color: 'var(--accent-secondary)', background: 'var(--bg-secondary-subtle)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{formatDuration(summary?.total_downtime_formatted)}</span>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>รวมระยะเวลาทั้งหมด</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="ค้นหาชื่ออุปกรณ์..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.6rem 0.6rem 2.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>จังหวัด:</span>
              <select
                value={selectedProvince}
                onChange={(e) => { setSelectedProvince(e.target.value); setCurrentPage(1); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                }}
              >
                {provinces.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            แสดง <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentLogs.length}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filteredLogs.length}</span> รายการ
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>อุปกรณ์</th>
                <th
                  onClick={() => requestSort('province')}
                  style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}
                >
                  จังหวัด {sortConfig.key === 'province' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => requestSort('down_at')}
                  style={{ padding: '1rem 1.5rem', color: 'var(--accent-danger)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  เวลาขัดข้อง {sortConfig.key === 'down_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600 }}>เวลากลับออนไลน์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>ระยะเวลา</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {currentLogs.length > 0 ? (
                currentLogs.map((log, index) => (
                  <tr key={log.id || index} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{log.pea_name || log.device?.pea_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'ui-monospace' }}>{log.device?.gateway}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{log.province || log.device?.province || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--accent-danger)' }}>
                      {new Date(log.down_at).toLocaleString('th-TH')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--accent-success)' }}>
                      {log.up_at ? new Date(log.up_at).toLocaleString('th-TH') : (
                        <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>ยังไม่กลับมาออนไลน์</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 700, fontFamily: '"Krub", sans-serif' }}>
                      {formatDuration(log.duration_formatted) || formatDuration(log.duration_ms ? `${Math.floor(log.duration_ms / 86400000)}:${Math.floor((log.duration_ms % 86400000) / 3600000)}:${Math.floor((log.duration_ms % 3600000) / 60000)}:${Math.floor((log.duration_ms % 60000) / 1000)}` : null)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                        background: log.status === 'down' ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
                        color: log.status === 'down' ? 'var(--accent-danger)' : 'var(--accent-success)',
                        fontWeight: 600
                      }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <History size={48} style={{ opacity: 0.1 }} />
                      <p>ไม่พบประวัติการขัดข้อง</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              หน้า <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalPages}</span>
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DowntimeHistory;
