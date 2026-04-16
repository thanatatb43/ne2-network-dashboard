import React from 'react';
import { Activity, Database, CheckCircle, Globe } from 'lucide-react';

const StatsGrid = ({ metrics }) => {
  const stats = [
    { label: 'อุปกรณ์เครือข่ายทั้งหมด', value: `${metrics.totalDevices || 0} Node`, icon: Database, color: 'var(--accent-primary)' },
    { label: 'อุปกรณ์ที่ออนไลน์', value: `${metrics.onlineDevices || 0} Node`, icon: CheckCircle, color: 'var(--accent-success)' },
    { label: 'ค่าเฉลี่ย กฟฉ.2', value: `${metrics.latency || 0} ms`, icon: Activity, color: 'var(--accent-warning)' },
    { label: 'ความเร็วเน็ตของคุณ', value: `${metrics.throughput || 0} Mb/s`, icon: Globe, color: 'var(--accent-secondary)' },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat, index) => (
        <div key={index} className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: `${stat.color}20`, color: stat.color }}>
              <stat.icon size={24} />
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{stat.label}</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{stat.value}</h3>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
