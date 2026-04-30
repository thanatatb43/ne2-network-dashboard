import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NetworkChart = ({ history }) => {
  return (
    <div className="card glass" style={{ height: '400px', marginBottom: '2rem', padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>ค่าเฉลี่ย Latency ระบบเครือข่าย กฟฉ.2</h3>
      <div style={{ width: '100%', height: 'calc(100% - 3rem)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
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
              unit=" ms"
            />
            <Tooltip
              contentStyle={{
                background: 'var(--tooltip-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                backdropFilter: 'blur(4px)',
                color: 'var(--text-primary)'
              }}
              itemStyle={{ color: 'var(--accent-primary)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--accent-primary)"
              fillOpacity={1}
              fill="url(#colorValue)"
              isAnimationActive={true}
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default NetworkChart;
