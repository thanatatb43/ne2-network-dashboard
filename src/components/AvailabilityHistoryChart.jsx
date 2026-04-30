import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const AvailabilityHistoryChart = ({ history }) => {
  return (
    <div className="card glass" style={{ height: '400px', marginBottom: '2.5rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-success)' }}>
          <Activity size={20} />
        </div>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>ประวัติความพร้อมใช้งาน (Availability History)</h3>
      </div>

      <div style={{ width: '100%', height: 'calc(100% - 3.5rem)' }}>
        {history && history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorAvailability" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(4px)'
                }}
                itemStyle={{ color: 'var(--accent-success)' }}
                formatter={(value) => [`${value}%`, 'Availability']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent-success)"
                fillOpacity={1}
                fill="url(#colorAvailability)"
                isAnimationActive={true}
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <Activity size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
            <p>ไม่พบข้อมูลประวัติความพร้อมใช้งาน</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailabilityHistoryChart;
