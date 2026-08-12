import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Activity, AlertCircle, Clock, Download, Search, ChevronLeft, ChevronRight, TrendingUp, Trophy } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const formatDurationMs = (ms) => {
  if (!ms) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const result = [];
  if (d > 0) result.push(`${d} วัน`);
  if (h > 0) result.push(`${h} ชั่วโมง`);
  if (m > 0) result.push(`${m} นาที`);
  if (d === 0 && h === 0 && s > 0) result.push(`${s} วินาที`);
  return result.length > 0 ? result.join(' ') : '-';
};

const DowntimeHistory = ({ token, onDeviceClick }) => {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [dashboard, setDashboard] = useState(null);
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

        const [summaryRes, logsRes, dashboardRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/summary`, { headers }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/all`, { headers }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/downtime/dashboard`, { headers })
        ]);

        const summaryData = await summaryRes.json();
        const logsData = await logsRes.json();
        const dashboardData = await dashboardRes.json();

        if (summaryData.success) setSummary(summaryData.data);
        if (logsData.success) setLogs(logsData.data || []);
        if (dashboardData.success) setDashboard(dashboardData);
      } catch (error) {
        console.error('Error fetching downtime history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const monthlyChartData = React.useMemo(() => {
    if (!dashboard?.monthly) return [];
    return dashboard.monthly.map(m => ({
      month: THAI_MONTHS[m.month - 1] || m.month,
      incident_count: m.incident_count,
      total_duration_ms: m.total_duration_ms
    }));
  }, [dashboard]);

  const dailyChartData = React.useMemo(() => {
    if (!dashboard?.daily) return [];
    return dashboard.daily.map(d => ({
      date: d.date,
      dateLabel: d.date ? `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}` : '',
      incident_count: d.incident_count,
      total_duration_ms: d.total_duration_ms
    }));
  }, [dashboard]);

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

      {/* Yearly Downtime Dashboard */}
      {dashboard && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <TrendingUp size={20} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>แนวโน้มการขัดข้อง ปี {dashboard.year}</h2>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>เหตุการณ์ทั้งปี: <strong style={{ color: 'var(--text-primary)' }}>{dashboard.yearly?.incident_count ?? 0}</strong></span>
              <span>เวลารวม: <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(dashboard.yearly?.total_duration_formatted)}</strong></span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Top 10 Problem Devices */}
            <div className="card glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Trophy size={18} color="var(--accent-warning)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>10 อันดับอุปกรณ์ขัดข้องบ่อยที่สุด</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(dashboard.top_devices || []).map((d, i) => (
                  <div
                    key={d.device_id}
                    onClick={() => onDeviceClick && onDeviceClick(d.device_id)}
                    className="table-row-hover"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      cursor: onDeviceClick ? 'pointer' : 'default'
                    }}
                  >
                    <span style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: i < 3 ? 'var(--bg-danger-subtle)' : 'var(--glass-bg-subtle)',
                      color: i < 3 ? 'var(--accent-danger)' : 'var(--text-secondary)'
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.pea_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {d.province || '-'} · {formatDuration(d.total_duration_formatted)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '1rem',
                      background: 'var(--bg-danger-subtle)',
                      color: 'var(--accent-danger)',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {d.incident_count} ครั้ง
                    </span>
                  </div>
                ))}
                {(!dashboard.top_devices || dashboard.top_devices.length === 0) && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>ไม่มีข้อมูล</p>
                )}
              </div>
            </div>

            {/* Monthly Incident Chart */}
            <div className="card glass" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700 }}>จำนวนเหตุการณ์รายเดือน</h3>
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--tooltip-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        backdropFilter: 'blur(4px)',
                        color: 'var(--text-primary)'
                      }}
                      formatter={(value, name, props) => {
                        if (name === 'incident_count') return [`${value} ครั้ง`, 'เหตุการณ์'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        const dur = payload?.[0]?.payload?.total_duration_ms;
                        return dur ? `${label} · รวม ${formatDurationMs(dur)}` : label;
                      }}
                    />
                    <Bar dataKey="incident_count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Daily Incident Trend */}
          <div className="card glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700 }}>แนวโน้มเหตุการณ์รายวัน</h3>
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(dailyChartData.length / 12) - 1)}
                  />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--tooltip-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(value) => [`${value} ครั้ง`, 'เหตุการณ์']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                  />
                  <Line type="monotone" dataKey="incident_count" stroke="var(--accent-secondary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
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
