import React from 'react';
import { Database, CheckCircle, AlertCircle, Activity, Globe } from 'lucide-react';

const fmtCount = (n) => (typeof n === 'number' ? n.toLocaleString('th-TH') : '—');

// value/sampleCount come from useNetworkData's computeStats -- value is
// null (not 0) when nothing valid could be measured, so that case is
// rendered as "—" instead of a misleading "0".
const fmtAvg = (avg, unit, totalDevices) => {
  if (!avg || avg.value === null) return { value: '—', detail: 'ไม่มีค่าที่วัดได้' };
  return {
    value: `${avg.value.toFixed(1)} ${unit}`,
    detail: `จาก ${avg.sampleCount.toLocaleString('th-TH')}/${totalDevices.toLocaleString('th-TH')} อุปกรณ์ที่มีค่า`,
  };
};

const StatsGrid = ({ stats, metricsState, onNavigateDevices, onNavigateDown }) => {
  const initialLoad = metricsState.loading && !metricsState.lastUpdated;
  const loadFailed = Boolean(metricsState.error) && !metricsState.lastUpdated;

  const cards = [
    {
      key: 'total',
      label: 'อุปกรณ์เครือข่ายทั้งหมด',
      value: stats.totalDevices,
      icon: Database,
      tone: 'accent',
      onClick: () => onNavigateDevices(null),
      detail: stats.unknownDevices > 0 ? `รวมไม่ทราบสถานะ ${fmtCount(stats.unknownDevices)} เครื่อง` : null,
    },
    {
      key: 'online',
      label: 'อุปกรณ์ที่ออนไลน์',
      value: stats.onlineDevices,
      icon: CheckCircle,
      tone: 'success',
      onClick: () => onNavigateDevices('up'),
      detail: stats.totalDevices ? `${((stats.onlineDevices / stats.totalDevices) * 100).toFixed(0)}% ของทั้งหมดขณะนี้` : null,
    },
    {
      key: 'down',
      label: 'อุปกรณ์ที่ขัดข้อง',
      value: stats.downDevices,
      icon: AlertCircle,
      tone: 'danger',
      onClick: stats.downDevices > 0 ? onNavigateDown : undefined,
      detail: stats.downDevices === 0 ? 'ไม่มีอุปกรณ์ขัดข้อง' : null,
    },
  ];

  const avgLatency = fmtAvg(stats.avgLatency, 'ms', stats.totalDevices);
  const avgLoss = fmtAvg(stats.avgPacketLoss, '%', stats.totalDevices);

  return (
    <div className="network-stats">
      <div className="stats-grid" aria-busy={initialLoad}>
        {cards.map((stat) => {
          const clickable = Boolean(stat.onClick) && !initialLoad && !loadFailed;
          const Tag = clickable ? 'button' : 'div';
          return (
            <Tag
              key={stat.key}
              type={clickable ? 'button' : undefined}
              className={`card network-stat-card network-stat-${stat.tone}`}
              onClick={clickable ? stat.onClick : undefined}
              aria-label={clickable ? `${stat.label}: ${fmtCount(stat.value)} เครื่อง -- ดูรายการ` : undefined}
            >
              <div className="network-stat-icon">
                <stat.icon size={24} aria-hidden="true" />
              </div>
              <div className="network-stat-body">
                <p className="network-stat-label">{stat.label}</p>
                <h3 className="network-stat-value">
                  {initialLoad ? 'กำลังโหลด…' : loadFailed ? '—' : `${fmtCount(stat.value)} เครื่อง`}
                </h3>
                {!initialLoad && !loadFailed && stat.detail && <p className="network-stat-detail">{stat.detail}</p>}
              </div>
            </Tag>
          );
        })}
      </div>

      <div className="network-quality-row">
        <div className="network-quality-item">
          <Activity size={16} aria-hidden="true" />
          <span>ค่าเฉลี่ย Latency: <strong>{initialLoad ? 'กำลังโหลด…' : avgLatency.value}</strong></span>
          {!initialLoad && <span className="list-muted">({avgLatency.detail})</span>}
        </div>
        <div className="network-quality-item">
          <Globe size={16} aria-hidden="true" />
          <span>ค่าเฉลี่ย Packet Loss: <strong>{initialLoad ? 'กำลังโหลด…' : avgLoss.value}</strong></span>
          {!initialLoad && <span className="list-muted">({avgLoss.detail})</span>}
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;
