import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useNetworkData } from '../hooks/useNetworkData';
import StatsGrid from './StatsGrid';
import AttentionList from './AttentionList';
import NetworkChart from './NetworkChart';
import './ListPage.css';
import './NetworkOverview.css';

// Overview/dashboard page for network devices -- extracted out of App.jsx
// (NETWORK_DEVICES_IMPROVEMENT_PLAN.md section 9) now that it owns real
// loading/error state instead of a single flat `metrics`/`history` pair.
const NetworkOverview = ({ onDeviceClick, onNavigateDevices, onNavigateDown }) => {
  const { stats, attentionList, chartHistory, metricsState, summaryState, refresh } = useNetworkData();

  // "Live Feed" reflects whether the last metrics fetch actually succeeded,
  // not a permanently-on indicator -- a failed poll must never look like
  // the system is still monitoring normally.
  const feedOk = Boolean(metricsState.lastUpdated) && !metricsState.error;
  const refreshing = metricsState.loading && Boolean(metricsState.lastUpdated);
  const anyLoadFailed = Boolean(metricsState.error) || Boolean(summaryState.error);

  return (
    <div className="list-page network-overview">
      <header className="network-overview-header">
        <div>
          <h1>ภาพรวมเครือข่าย</h1>
          <p className="list-muted">ระบบตรวจสอบสถานะอุปกรณ์เครือข่ายภายในสำนักงาน กฟฉ.2 · แผนกคอมพิวเตอร์และเครือข่าย กดส.ฉ.2 · อัปเดตอัตโนมัติทุก 1 นาที</p>
        </div>
        <div className="network-overview-actions">
          <span className={`network-feed-indicator ${feedOk ? 'is-ok' : 'is-down'}`}>
            <span className="network-feed-dot" aria-hidden="true" />
            {feedOk ? 'เชื่อมต่อสำเร็จ' : 'ขาดการเชื่อมต่อ'}
          </span>
          <span className="list-muted" role="status">
            {metricsState.lastUpdated ? `โหลดข้อมูลล่าสุด ${metricsState.lastUpdated.toLocaleTimeString('th-TH')}` : 'ยังไม่มีข้อมูลที่โหลดสำเร็จ'}
          </span>
          <button className="list-button" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'กำลังรีเฟรช' : 'รีเฟรช'}
          </button>
        </div>
      </header>

      {metricsState.error && metricsState.lastUpdated && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>รีเฟรชข้อมูลอุปกรณ์ล่าสุดไม่สำเร็จ</strong><p>กำลังแสดงข้อมูลจากการโหลดครั้งก่อน สถานะอุปกรณ์อาจเปลี่ยนแปลงแล้ว</p></div>
          <button className="list-button" onClick={refresh}>ลองใหม่</button>
        </div>
      )}
      {metricsState.error && !metricsState.lastUpdated && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>ไม่สามารถโหลดข้อมูลอุปกรณ์ได้</strong><p>ตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p></div>
          <button className="list-button" onClick={refresh}>ลองใหม่</button>
        </div>
      )}

      <StatsGrid stats={stats} metricsState={metricsState} onNavigateDevices={onNavigateDevices} onNavigateDown={onNavigateDown} />
      <AttentionList attentionList={attentionList} metricsState={metricsState} onDeviceClick={onDeviceClick} onViewAll={() => onNavigateDevices(null)} />
      <NetworkChart history={chartHistory} summaryState={summaryState} onRetry={refresh} />

      {!anyLoadFailed && <p className="list-sr-only" role="status">ข้อมูลอัปเดตอัตโนมัติทุก 1 นาที</p>}
    </div>
  );
};

export default NetworkOverview;
