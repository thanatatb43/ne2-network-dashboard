import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-react';
import { IP_RANGE_GROUPS, SUBNET_KINDS, findIpGroups, rangeText, siteSubnets } from './ipAllocationReference.js';

// Advisory only: never writes into the IP field and never claims an address is free.
export default function SiteNetworkSection({ siteId, network, equipmentType, department }) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  const subnets = siteSubnets(network.network);
  const groups = findIpGroups({ equipmentType, department });

  return (
    <div className="ef-network">
      <div className="ef-network-context" aria-live="polite">
        {!siteId ? (
          <p className="list-muted">เลือกสำนักงานก่อน จึงจะแสดงวงเครือข่ายและช่วง IP แนะนำ</p>
        ) : network.status === 'loading' ? (
          <p className="list-muted"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> กำลังโหลดวงเครือข่ายของสำนักงาน...</p>
        ) : network.status === 'error' ? (
          <p className="ef-inline-error" role="alert">{network.error} — ยังกรอกและบันทึกข้อมูลได้ตามปกติ <button type="button" className="ef-link" onClick={network.retry}>ลองใหม่</button></p>
        ) : subnets.length === 0 ? (
          <p className="list-muted">ยังไม่มีข้อมูลวงเครือข่ายของสำนักงานนี้</p>
        ) : (
          <ul className="ef-subnets" aria-label="วงเครือข่ายของสำนักงาน">
            {subnets.map(s => <li key={s.key}><span>{s.label}</span><code>{s.value}</code></li>)}
          </ul>
        )}
      </div>

      {groups.length > 0 && (
        <div className="ef-suggestions">
          {groups.map(g => {
            const parts = SUBNET_KINDS.map(k => g[k.rangeKey] && `${k.label} ${rangeText(network.network?.[k.key], g[k.rangeKey])}`).filter(Boolean);
            return (
              <p key={g.group}>
                <Info size={14} aria-hidden="true" /> ช่วงตามแผนสำหรับ “{g.group}”: {parts.length ? parts.join(' / ') : 'แผนไม่ได้กำหนดช่วง'}
              </p>
            );
          })}
          <p className="list-muted">เป็นแผนจัดสรรอ้างอิง (สมมติวง /24) ไม่ได้ตรวจว่า IP ว่าง — ตรวจสอบก่อนใช้งานจริง</p>
        </div>
      )}

      <button type="button" className="ef-link ef-disclosure" aria-expanded={showTable} aria-controls={`${id}-ref`} onClick={() => setShowTable(v => !v)}>
        {showTable ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />} ตารางแผนช่วง IP ทั้งหมด
      </button>
      <div id={`${id}-ref`} hidden={!showTable} className="ef-ipref">
        <p className="list-muted">เลขท้ายของแต่ละวงตามแผนเดิม บางช่วงทับกันและจำนวนตามแผนบางแถวยังไม่ตรงกับความกว้างช่วง รอผู้ดูแลแผนยืนยัน</p>
        <div className="ef-ipref-table" tabIndex={0} role="region" aria-label="ตารางแผนช่วง IP">
          <table>
            <thead><tr><th scope="col">กลุ่ม</th>{SUBNET_KINDS.map(k => <th key={k.key} scope="col">{k.label}</th>)}<th scope="col" className="ef-num">จำนวนตามแผน</th></tr></thead>
            <tbody>{IP_RANGE_GROUPS.map(g => (
              <tr key={g.group}><th scope="row">{g.group}</th>{SUBNET_KINDS.map(k => <td key={k.key}>{g[k.rangeKey] || '—'}</td>)}<td className="ef-num">{g.plannedCount ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <dl className="ef-ipref-list">
          {IP_RANGE_GROUPS.map(g => (
            <div key={g.group}><dt>{g.group}</dt><dd>{SUBNET_KINDS.map(k => g[k.rangeKey] && `${k.label}: ${g[k.rangeKey]}`).filter(Boolean).join(' · ') || 'ไม่ได้กำหนดช่วง'}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
