import { AppWindow, BrickWall, Building2, Cable, CircleDot, DoorOpen, Hand, Monitor, MousePointer2, Plug, Square, Table, Type } from 'lucide-react';
import { SymbolIcon } from '../rendering/DrawingSymbols.jsx';
import { SYMBOL_LABELS } from '../officeDrawingDocument.js';

const GROUPS = [
  { title: 'ทั่วไป', tools: [['select', 'เลือก/ย้าย', MousePointer2, 'V'], ['pan', 'เลื่อนผัง', Hand, 'H']] },
  { title: 'โครงสร้าง', tools: [['building', 'อาคาร', Building2], ['room', 'ห้อง', Square], ['wall', 'ผนัง', BrickWall], ['door', 'ประตู', DoorOpen], ['window', 'หน้าต่าง', AppWindow], ['desk', 'โต๊ะ', Table]] },
  { title: 'อุปกรณ์และสาย', tools: [['equipment', 'อุปกรณ์', Monitor], ['outlet', 'Outlet', Plug], ['junction', 'จุดต่อสาย', CircleDot], ['cable', 'แนวสาย', Cable]] },
  { title: 'ข้อความ', tools: [['text', 'ข้อความ', Type]] }
];

const HINTS = {
  select: 'คลิกเลือก ลากเพื่อย้าย · Shift+คลิก เลือกเพิ่ม · ลากพื้นที่ว่างเพื่อเลือกหลายชิ้น',
  pan: 'ลากเพื่อเลื่อนผัง (หรือกด Alt ค้างแล้วลาก)',
  building: 'ลากเพื่อวาดกรอบอาคาร หรือคลิกเพื่อวางขนาดมาตรฐาน', room: 'ลากเพื่อวาดห้อง', desk: 'ลากเพื่อวาดโต๊ะ',
  door: 'ลากหรือคลิกเพื่อวางประตู แล้วเลือกด้านบานพับ/ทิศเปิดในแผงขวา', window: 'ลากหรือคลิกเพื่อวางหน้าต่าง',
  wall: 'คลิกทีละจุด · ดับเบิลคลิกหรือ Enter เพื่อจบ · Esc ยกเลิก · Shift ล็อกแนวนอน/ตั้ง',
  cable: 'คลิกที่อุปกรณ์/จุดต่อเพื่อเริ่ม คลิกจุดหักมุม แล้วคลิกอุปกรณ์ปลายทางเพื่อจบ (หรือดับเบิลคลิก/Enter)',
  equipment: 'เลือกสัญลักษณ์ แล้วคลิกบนผังเพื่อวาง (วางต่อได้หลายชิ้น)', outlet: 'เลือกชนิด Outlet แล้วคลิกเพื่อวาง', junction: 'คลิกเพื่อวางจุดต่อสาย',
  text: 'ลากเพื่อกำหนดกรอบข้อความ แล้วพิมพ์ข้อความในแผงขวา'
};

export default function DrawingToolbar({ tool, onTool, options, onOptions, symbolKeys, cableStyles, axisLock, onAxisLock }) {
  return (
    <div className="od-toolbar" role="toolbar" aria-label="เครื่องมือวาด" aria-orientation="vertical">
      {GROUPS.map(g => (
        <div key={g.title} className="od-tool-group" role="group" aria-label={g.title}>
          <span className="od-tool-group-title">{g.title}</span>
          <div className="od-tool-grid">
            {g.tools.map((entry) => { const [key, label, Icon, kb] = entry; return (
              <button key={key} type="button" className={`od-tool${tool === key ? ' is-active' : ''}`} aria-pressed={tool === key}
                title={`${label}${kb ? ` (${kb})` : ''}`} onClick={() => onTool(key)}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </button>
            ); })}
          </div>
        </div>
      ))}

      <p className="od-tool-hint">{HINTS[tool]}</p>

      {(tool === 'equipment' || tool === 'outlet') && (
        <div className="od-tool-group" role="group" aria-label="เลือกสัญลักษณ์">
          <span className="od-tool-group-title">สัญลักษณ์</span>
          <div className="od-symbol-grid">
            {(symbolKeys[tool] || []).map(k => (
              <button key={k} type="button" className={`od-symbol${options.symbol[tool] === k ? ' is-active' : ''}`} aria-pressed={options.symbol[tool] === k}
                title={SYMBOL_LABELS[k] || k} onClick={() => onOptions({ symbol: { ...options.symbol, [tool]: k } })}>
                <SymbolIcon symbolKey={k} size={22} /><span>{SYMBOL_LABELS[k] || k}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {tool === 'cable' && (
        <div className="od-tool-group" role="radiogroup" aria-label="ชนิดสาย">
          <span className="od-tool-group-title">ชนิดสาย</span>
          {cableStyles.map(c => (
            <label key={c.key} className={`od-cable-option${options.cableStyle === c.key ? ' is-active' : ''}`}>
              <input type="radio" name="od-cable-style" value={c.key} checked={options.cableStyle === c.key} onChange={() => onOptions({ cableStyle: c.key })} />
              <svg width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke={c.stroke} strokeWidth="3" strokeDasharray={c.dash === 'dashed' ? '6 4' : c.dash === 'dotted' ? '1 4' : undefined} strokeLinecap={c.dash === 'dotted' ? 'round' : 'butt'} /></svg>
              {c.label}
            </label>
          ))}
        </div>
      )}
      {tool === 'wall' && (
        <label className="od-tool-field">ความหนาผนัง (มม. บนกระดาษ)
          <input type="number" min="0.5" max="100" step="0.5" value={options.wallThickness} onChange={e => onOptions({ wallThickness: Math.min(100, Math.max(0.5, Number(e.target.value) || 2)) })} />
        </label>
      )}
      {(tool === 'wall' || tool === 'cable') && (
        <label className="od-check"><input type="checkbox" checked={axisLock} onChange={e => onAxisLock(e.target.checked)} /> ล็อกแนวนอน/แนวตั้ง</label>
      )}
    </div>
  );
}
