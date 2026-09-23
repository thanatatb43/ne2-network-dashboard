import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

// recharts can call this with a payload whose shape doesn't match what's
// currently expected -- e.g. mid-transition right after the 60s auto-refresh
// swaps `history` while the tooltip is still active from a previous hover.
// Every access here is guarded so a stale/partial payload renders nothing
// useful instead of throwing (an uncaught error with no error boundary
// above it takes down the whole page to a blank screen).
const Tip = ({ active, payload, unit, label: dataKey }) => {
  const point = active ? payload?.[0]?.payload : null;
  if (!point) return null;
  const value = point[dataKey];
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  return (
    <div className="network-chart-tooltip">
      <div>{point.fullLabel || point.time || ''}</div>
      <div>{hasValue ? `${value.toFixed(1)} ${unit}` : 'ไม่มีข้อมูล'}</div>
    </div>
  );
};

// One trend chart, reused for both latency and packet loss -- each has its
// own unit, gradient id (recharts gradients leak across charts sharing an
// id) and empty/error state so one metric failing to load doesn't blank
// the other.
const TrendChart = ({ title, dataKey, unit, gradientId, color, history, state, onRetry, animate }) => {
  const initialLoad = state.loading && !state.lastUpdated;
  const loadFailed = Boolean(state.error) && !state.lastUpdated;
  const hasPoints = history.length > 0;
  const rangeLabel = hasPoints ? `${history[0].time}–${history[history.length - 1].time}` : null;

  return (
    <div className="card network-chart-card">
      <div className="network-chart-head">
        <h3>{title}</h3>
        {rangeLabel && <span className="list-muted">ช่วงเวลาที่มีข้อมูลจริง: {rangeLabel}</span>}
      </div>
      {initialLoad ? (
        <div className="network-chart-empty">กำลังโหลดแนวโน้ม…</div>
      ) : loadFailed ? (
        <div className="network-chart-empty" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>โหลดแนวโน้มไม่สำเร็จ</span>
          <button className="list-button" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" /> ลองใหม่
          </button>
        </div>
      ) : !hasPoints ? (
        <div className="network-chart-empty">ยังไม่มีข้อมูลแนวโน้มในช่วงนี้</div>
      ) : (
        <div className="network-chart-body">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} unit={` ${unit}`} />
              <Tooltip content={<Tip unit={unit} label={dataKey} />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                isAnimationActive={animate}
                strokeWidth={3}
                connectNulls={false}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {state.error && state.lastUpdated && (
        <p className="network-chart-stale-note">แสดงแนวโน้มจากการโหลดครั้งก่อน การรีเฟรชล่าสุดไม่สำเร็จ</p>
      )}
    </div>
  );
};

const NetworkChart = ({ history, summaryState, onRetry }) => {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="network-charts-grid">
      <TrendChart
        title="แนวโน้ม Latency เฉลี่ย (ms)"
        dataKey="latency"
        unit="ms"
        gradientId="colorLatency"
        color="var(--accent-primary)"
        history={history}
        state={summaryState}
        onRetry={onRetry}
        animate={!reducedMotion}
      />
      <TrendChart
        title="แนวโน้ม Packet Loss เฉลี่ย (%)"
        dataKey="packetLoss"
        unit="%"
        gradientId="colorLoss"
        color="var(--accent-secondary)"
        history={history}
        state={summaryState}
        onRetry={onRetry}
        animate={!reducedMotion}
      />
    </div>
  );
};

export default NetworkChart;
