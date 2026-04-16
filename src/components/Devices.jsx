import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Search, RefreshCw, ChevronDown } from 'lucide-react';

const Devices = ({ onDeviceClick }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const filteredDevices = devices.filter(d =>
    d.device?.pea_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.device?.gateway?.includes(searchTerm) ||
    d.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    if (a.status === 'down' && b.status !== 'down') return 1;
    if (a.status !== 'down' && b.status === 'down') return -1;
    const latA = a.latency_ms || Infinity;
    const latB = b.latency_ms || Infinity;
    return latA - latB;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedDevices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedDevices.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
        <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="ค้นหาอุปกรณ์..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', width: '250px' }}
          />
        </div>
      </header>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <th style={{ padding: '1.25rem 1.5rem', width: '60px' }}>No.</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>PEA Name</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>Province</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>Gateway IP</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>Latency (ms)</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>Packet Loss</th>
              <th style={{ padding: '1.25rem 1.5rem' }}>Status</th>
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
                <td style={{ padding: '1.25rem 1.5rem', fontFamily: 'ui-monospace', fontSize: '0.9rem' }}>{d.device?.gateway || '-'}</td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <span style={{
                    color: !d.latency_ms || d.status === 'down' ? 'var(--accent-danger)' : d.latency_ms > 150 ? 'var(--accent-danger)' : d.latency_ms > 80 ? 'var(--accent-warning)' : 'var(--accent-success)',
                    fontWeight: 600
                  }}>
                    {d.latency_ms ? `${d.latency_ms.toFixed(2)} ms` : 'N/A'}
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
            className="glass"
            style={{ padding: '0.5rem 1rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#fff', opacity: currentPage === 1 ? 0.3 : 1 }}
          >
            Prev
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.9rem' }}>Go to:</span>
            <select
              value={currentPage}
              onChange={(e) => paginate(Number(e.target.value))}
              className="glass"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.5rem',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {[...Array(totalPages).keys()].map(n => (
                <option key={n + 1} value={n + 1} style={{ background: '#1e293b' }}>
                  Page {n + 1}
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.9rem' }}>of {totalPages}</span>
          </div>
          <button
            disabled={currentPage === totalPages}
            onClick={() => paginate(currentPage + 1)}
            className="glass"
            style={{ padding: '0.5rem 1rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: '#fff', opacity: currentPage === totalPages ? 0.3 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Devices;
