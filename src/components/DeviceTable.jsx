import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

const DeviceTable = ({ onViewAll, user }) => {
  const [devices, setDevices] = useState([]);

  const fetchRecentDevices = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/recent`);
      const result = await response.json();

      if (result.success && result.data) {
        // Group by device_id to collect history and track natural order
        const groupedData = {};
        const deviceOrder = [];

        result.data.forEach(item => {
          if (!groupedData[item.device_id]) {
            groupedData[item.device_id] = {
              id: item.device_id,
              name: item.device?.pea_name || 'Unknown Device',
              ip: item.device?.gateway || 'N/A',
              // Keep the status from the most recent record
              status: item.status === 'up' ? 'Online' : 'Offline',
              lastSeen: new Date(item.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              history: []
            };
            deviceOrder.push(item.device_id); // Keep API order
          }

          // Add latency point to history (handle nulls as 0 for graphing) 
          groupedData[item.device_id].history.push({
            time: new Date(item.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            latency: item.latency_ms || 0
          });
        });

        // Pick top 10 from the original API order and reverse history chronologically
        const formattedDevices = deviceOrder
          .filter(deviceId => groupedData[deviceId].status === 'Online')
          .slice(0, 10)
          .map(deviceId => {
            const device = groupedData[deviceId];
            return {
              ...device,
              history: device.history.reverse()
            };
          });

        setDevices(formattedDevices);
      }
    } catch (error) {
      console.error("Error fetching recent devices:", error);
    }
  };

  useEffect(() => {
    fetchRecentDevices();
    const interval = setInterval(fetchRecentDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Top 10 Latency ต่ำที่สุด</h3>
        <button
          onClick={onViewAll}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}>ดูทั้งหมด</button>
      </div>

      <div style={{ width: '100%' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 3.5fr',
          padding: '0 1rem 1rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          gap: '1rem',
          marginBottom: '0.5rem'
        }}>
          <div>ข้อมูลอุปกรณ์</div>
          <div>สถานะ</div>
          <div>Latency ปัจจุบัน</div>
          <div>ค่าย้อนหลัง</div>
        </div>

        {/* Body Rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {devices.map((device) => (
            <div key={device.id} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 3.5fr',
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>{device.name}</div>
                <div style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '0.875rem', 
                  fontFamily: 'ui-monospace',
                  filter: !user ? 'blur(4px)' : 'none',
                  transition: 'filter 0.3s ease',
                  userSelect: !user ? 'none' : 'auto'
                }}>
                  {device.ip}
                </div>
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: device.status === 'Online' ? 'var(--accent-success)' : 'var(--accent-danger)'
                }}>
                  {device.status === 'Online' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span style={{ fontSize: '0.875rem' }}>{device.status}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Last seen: {device.lastSeen}</div>
              </div>

              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: device.status === 'Online' ? 'var(--text-primary)' : 'var(--accent-danger)' }}>
                  {device.history.length > 0 ? device.history[device.history.length - 1].latency : 0} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>ms</span>
                </div>
              </div>

              <div style={{ height: '40px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={device.history}>
                    <defs>
                      <linearGradient id={`colorLat-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={device.status === 'Online' ? "var(--accent-primary)" : "var(--accent-danger)"} stopOpacity={0.6} />
                        <stop offset="95%" stopColor={device.status === 'Online' ? "var(--accent-primary)" : "var(--accent-danger)"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(value) => [`${value} ms`, 'Latency']}
                    />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Area
                      type="monotone"
                      dataKey="latency"
                      stroke={device.status === 'Online' ? "var(--accent-primary)" : "var(--accent-danger)"}
                      fill={`url(#colorLat-${device.id})`}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}

          {devices.length === 0 && (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading devices...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceTable;
