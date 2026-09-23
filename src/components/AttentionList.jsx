import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

const REASON_LABEL = {
  down: 'ขัดข้อง',
  high_loss: 'Packet loss สูง',
  high_latency: 'Latency สูง',
};
const REASON_TONE = { down: 'down', high_loss: 'warning', high_latency: 'warning' };
const MAX_ROWS = 15;

const fmtNum = (value, digits = 1) => (value === null ? '—' : value.toFixed(digits));
const fmtChecked = (date) => (date ? date.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');

// "อุปกรณ์ที่ควรตรวจสอบ" -- devices that are down or showing high
// packet loss / latency, replacing the old "Top 10 lowest latency" list
// (which didn't actually help find problems). See
// NETWORK_DEVICES_IMPROVEMENT_PLAN.md section 5.2.
const AttentionList = ({ attentionList, metricsState, onDeviceClick, onViewAll }) => {
  const initialLoad = metricsState.loading && !metricsState.lastUpdated;
  const loadFailed = Boolean(metricsState.error) && !metricsState.lastUpdated;
  const rows = attentionList.slice(0, MAX_ROWS);

  return (
    <section className="list-panel network-attention-panel" aria-label="อุปกรณ์ที่ควรตรวจสอบ">
      <div className="network-attention-head">
        <div>
          <h2>อุปกรณ์ที่ควรตรวจสอบ</h2>
          <p className="list-muted">อุปกรณ์ขัดข้อง หรือมี packet loss/latency สูงกว่าเกณฑ์ปฏิบัติงานเบื้องต้น</p>
        </div>
        <button className="list-button" onClick={onViewAll}>ดูทั้งหมด</button>
      </div>

      {initialLoad ? (
        <div className="network-attention-empty">กำลังโหลดรายการที่ควรตรวจสอบ…</div>
      ) : loadFailed ? (
        <div className="network-attention-empty" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>โหลดรายการไม่สำเร็จ</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="network-attention-empty">ไม่พบอุปกรณ์ที่ต้องตรวจตามเกณฑ์ในขณะนี้</div>
      ) : (
        <div className="list-table-scroll" role="region" aria-label="ตารางอุปกรณ์ที่ควรตรวจสอบ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์" tabIndex={0}>
          <table className="list-table">
            <caption className="list-sr-only">อุปกรณ์ที่ควรตรวจสอบ กดชื่อสำนักงานเพื่อเปิดรายละเอียด</caption>
            <thead>
              <tr>
                <th scope="col">สำนักงาน</th>
                <th scope="col">จังหวัด</th>
                <th scope="col">สถานะ / เหตุผลที่ควรตรวจ</th>
                <th scope="col">Latency (ms)</th>
                <th scope="col">Packet loss (%)</th>
                <th scope="col">ตรวจสอบล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a
                      className="list-name"
                      title={d.name}
                      href={`/device/${d.id}`}
                      onClick={(e) => {
                        if (onDeviceClick && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                          e.preventDefault();
                          onDeviceClick(d.id);
                        }
                      }}
                    >
                      {d.name}
                    </a>
                  </td>
                  <td title={d.province || '—'}>{d.province || '—'}</td>
                  <td>
                    <span className={`list-status list-status-${REASON_TONE[d.reason]}`}>{REASON_LABEL[d.reason]}</span>
                  </td>
                  <td className="list-number">{fmtNum(d.latency)}</td>
                  <td className="list-number">{fmtNum(d.packetLoss)}</td>
                  <td className="list-muted">{fmtChecked(d.checkedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metricsState.error && metricsState.lastUpdated && (
        <p className="network-chart-stale-note">
          <RefreshCw size={14} aria-hidden="true" /> แสดงรายการจากการโหลดครั้งก่อน การรีเฟรชล่าสุดไม่สำเร็จ
        </p>
      )}
    </section>
  );
};

export default AttentionList;
