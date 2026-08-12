import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Loader2, Search, ChevronRight } from 'lucide-react';

const DownDevices = ({ onDeviceClick }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDownDevices = async (isRefresh = false) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/down`);
      const result = await response.json();
      if (result.success) {
        setDevices(result.data || []);
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error('Error fetching down devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDownDevices();
    const interval = setInterval(fetchDownDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredDevices = devices.filter(item => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (item.device?.pea_name && item.device.pea_name.toLowerCase().includes(q)) ||
      (item.device?.pea_type && item.device.pea_type.toLowerCase().includes(q)) ||
      (item.device?.province && item.device.province.toLowerCase().includes(q)) ||
      (item.device?.gateway && item.device.gateway.toLowerCase().includes(q))
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header style={{ marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle color="var(--accent-danger)" /> อุปกรณ์ที่ขัดข้อง (Offline)
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>รายการอุปกรณ์ที่ตรวจไม่พบสัญญาณล่าสุด</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem', borderRadius: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="ค้นหาอุปกรณ์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '180px' }}
            />
          </div>
          <button
            onClick={() => fetchDownDevices(true)}
            className="glass"
            style={{ padding: '0.6rem', borderRadius: '0.75rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่ออุปกรณ์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภท</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>จังหวัด</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Gateway IP</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Packet Loss</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ตรวจสอบล่าสุด</th>
                <th style={{ padding: '1rem 1.5rem', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && devices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังโหลดข้อมูล...</p>
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-success)' }}>
                    ไม่มีอุปกรณ์ที่ขัดข้องในขณะนี้
                  </td>
                </tr>
              ) : (
                filteredDevices.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onDeviceClick && onDeviceClick(item.device_id)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onDeviceClick ? 'pointer' : 'default' }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{item.device?.pea_name || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.device?.pea_type || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.device?.province || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.device?.gateway || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--accent-danger)', fontWeight: 600 }}>{item.packet_loss ?? '-'}%</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {item.checked_at ? new Date(item.checked_at).toLocaleString('th-TH') : '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <ChevronRight size={18} color="var(--text-secondary)" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default DownDevices;
