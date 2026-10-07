import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Copy, Download, Eye, Grid3x3, Loader2, Magnet, Maximize, MoreHorizontal, PanelRight, Printer, Redo2, Save, Trash2, Undo2, ZoomIn, ZoomOut
} from 'lucide-react';
import ConfirmDialog from '../../equipment-form/ConfirmDialog.jsx';
import '../../equipment-form/ConfirmDialog.css';
import { cablesReferencing, deleteObjects, duplicateObjects } from '../officeDrawingDocument.js';
import { moveObjects } from '../officeDrawingGeometry.js';
import DrawingCanvas from './DrawingCanvas.jsx';
import { LINE_TOOLS } from './editorTools.js';
import DrawingToolbar from './DrawingToolbar.jsx';
import DrawingInspector from './DrawingInspector.jsx';
import EquipmentLinkPicker from './EquipmentLinkPicker.jsx';
import DrawingPrintPreview from '../rendering/DrawingPrintPreview.jsx';

const TOOL_KEYS = { v: 'select', h: 'pan' };
const typingIn = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export default function DrawingEditor({
  entry, onCommit, canUndo, canRedo, onUndo, onRedo, readOnly, readOnlyNote, status, onSave, saving, dirty,
  caps, siteId, siteName, token, linkFor, linkStates, linksError, onRetryLinks, canLink, onAssetPicked,
  onBackToList, menu, banners, focusObjectId
}) {
  const { meta, doc } = entry;
  const [tool, setTool] = useState('select');
  const [toolOptions, setToolOptions] = useState({ symbol: { equipment: 'pc', outlet: 'outlet_lan' }, cableStyle: 'utp', wallThickness: 2 });
  const [selection, setSelection] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(() => doc.layers.find(l => !l.locked && l.visible !== false)?.id || doc.layers[0]?.id);
  const [scale, setScale] = useState(3);
  const [showGrid, setShowGrid] = useState(Boolean(doc.grid?.enabled));
  const [snap, setSnap] = useState(Boolean(doc.grid?.snap));
  const [axisLock, setAxisLock] = useState(false);
  const [picker, setPicker] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const canvasRef = useRef(null);

  // Selection follows the document (undo can remove what was selected).
  const liveSelection = selection.filter(id => id === '__legend' ? Boolean(doc.legend) : doc.objects.some(o => o.id === id));
  const layerValid = doc.layers.some(l => l.id === activeLayerId) ? activeLayerId : doc.layers[doc.layers.length - 1]?.id;

  // A save error pointing at an object selects it.
  const [focused, setFocused] = useState(null);
  if (focusObjectId && focusObjectId !== focused) { setFocused(focusObjectId); setSelection([focusObjectId]); }

  const commitDoc = (nextDoc) => { if (!readOnly && nextDoc !== doc) onCommit({ meta, doc: nextDoc }); };
  const commitMeta = (nextMeta) => { if (!readOnly) onCommit({ meta: nextMeta, doc }); };

  const requestDelete = (ids) => {
    const real = ids.filter(id => id !== '__legend');
    if (!real.length) return;
    const refs = cablesReferencing(doc, real);
    if (refs.length) setConfirmDelete({ ids: real, cables: refs.length });
    else { commitDoc(deleteObjects(doc, real)); setSelection([]); }
  };
  const duplicate = (ids) => {
    const real = ids.filter(id => id !== '__legend');
    if (!real.length) return;
    const { doc: next, ids: copies } = duplicateObjects(doc, real, { dx: doc.grid?.spacing || 5, dy: doc.grid?.spacing || 5 });
    commitDoc(next);
    setSelection(copies);
  };

  const chooseTool = (t) => {
    canvasRef.current?.cancel();
    setTool(t);
    if (t !== 'select') setSelection([]);
  };

  // Shortcuts never act while typing in a field or with a dialog open.
  useEffect(() => {
    const onKey = (e) => {
      if (typingIn(document.activeElement) || document.querySelector('[aria-modal="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (canvasRef.current?.cancel()) return;
        if (tool !== 'select') { setTool('select'); return; }
        setSelection([]);
        return;
      }
      if (readOnly) return;
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); return; }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); onRedo(); return; }
      if (mod && key === 's') { e.preventDefault(); onSave(); return; }
      if (mod && key === 'd') { e.preventDefault(); duplicate(liveSelection); return; }
      if (e.key === 'Enter' && LINE_TOOLS.includes(tool)) { e.preventDefault(); canvasRef.current?.finishLine(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && liveSelection.length) { e.preventDefault(); requestDelete(liveSelection); return; }
      if (e.key.startsWith('Arrow') && liveSelection.length) {
        e.preventDefault();
        const step = e.shiftKey ? (doc.grid?.spacing || 5) : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        const ids = liveSelection.filter(id => id !== '__legend');
        if (ids.length) commitDoc(moveObjects(doc, ids, d[0], d[1]));
        else if (liveSelection.includes('__legend')) commitDoc({ ...doc, legend: { ...doc.legend, x: doc.legend.x + d[0], y: doc.legend.y + d[1] } });
        return;
      }
      if (!mod && !e.altKey && TOOL_KEYS[key]) chooseTool(TOOL_KEYS[key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zoom = (k) => setScale(s => Math.max(0.5, Math.min(12, s * k)));
  const statusText = readOnly ? (readOnlyNote || 'โหมดดูอย่างเดียว')
    : saving ? 'กำลังบันทึก...'
      : dirty ? 'มีการแก้ไขที่ยังไม่บันทึก'
        : status;

  return (
    <div className={`od-editor${readOnly ? ' is-readonly' : ''}${panelOpen ? ' panel-open' : ''}`}>
      <header className="od-topbar">
        <div className="od-topbar-title">
          <button type="button" className="od-icon-button" onClick={onBackToList} title="กลับไปรายการแบบ"><ChevronLeft size={20} aria-hidden="true" /><span className="list-sr-only">กลับไปรายการแบบของ {siteName}</span></button>
          <div>
            <h1>{meta.name || 'แบบใหม่'}</h1>
            <p><span>{siteName}</span> · <span className={`od-status${dirty && !readOnly ? ' is-dirty' : ''}`} role="status">{statusText}</span></p>
          </div>
        </div>
        <div className="od-topbar-actions">
          {!readOnly && (
            <>
              <button type="button" className="od-icon-button" onClick={onUndo} disabled={!canUndo} title="เลิกทำ (Ctrl+Z)"><Undo2 size={18} aria-hidden="true" /><span className="list-sr-only">เลิกทำ</span></button>
              <button type="button" className="od-icon-button" onClick={onRedo} disabled={!canRedo} title="ทำซ้ำ (Ctrl+Y)"><Redo2 size={18} aria-hidden="true" /><span className="list-sr-only">ทำซ้ำ</span></button>
            </>
          )}
          <button type="button" className="list-button" onClick={() => setPrintOpen(true)}><Printer size={18} aria-hidden="true" /><span className="od-hide-sm"> พิมพ์</span></button>
          {!readOnly && (
            <button type="button" className="list-button list-button-primary" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />} บันทึก
            </button>
          )}
          {menu.length > 0 && (
            <div className="od-menu">
              <button type="button" className="od-icon-button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)} title="จัดการแบบ"><MoreHorizontal size={18} aria-hidden="true" /><span className="list-sr-only">จัดการแบบ</span></button>
              {menuOpen && (
                <ul className="od-menu-list" role="menu" onClick={() => setMenuOpen(false)}>
                  {menu.map(m => (
                    <li key={m.key} role="none">
                      <button type="button" role="menuitem" className={m.danger ? 'od-danger' : undefined} onClick={m.run}>
                        {{ duplicate: <Copy size={16} aria-hidden="true" />, export: <Download size={16} aria-hidden="true" />, delete: <Trash2 size={16} aria-hidden="true" /> }[m.key]} {m.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button type="button" className="od-icon-button od-panel-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen(o => !o)} title="แผงคุณสมบัติ"><PanelRight size={18} aria-hidden="true" /><span className="list-sr-only">แผงคุณสมบัติ</span></button>
        </div>
      </header>

      {banners}

      <div className="od-workspace">
        {!readOnly && (
          <DrawingToolbar tool={tool} onTool={chooseTool} options={toolOptions} onOptions={(c) => setToolOptions(o => ({ ...o, ...c }))}
            symbolKeys={caps.symbolKeys} cableStyles={caps.cableStyles} axisLock={axisLock} onAxisLock={setAxisLock} />
        )}
        <div className="od-stage">
          <div className="od-viewbar" role="toolbar" aria-label="มุมมอง">
            <button type="button" className="od-icon-button" onClick={() => zoom(1 / 1.25)} title="ซูมออก"><ZoomOut size={18} aria-hidden="true" /><span className="list-sr-only">ซูมออก</span></button>
            <span className="od-zoom">{Math.round(scale / 3 * 100)}%</span>
            <button type="button" className="od-icon-button" onClick={() => zoom(1.25)} title="ซูมเข้า"><ZoomIn size={18} aria-hidden="true" /><span className="list-sr-only">ซูมเข้า</span></button>
            <button type="button" className="od-icon-button" onClick={() => canvasRef.current?.fit()} title="พอดีหน้า"><Maximize size={18} aria-hidden="true" /><span className="list-sr-only">ปรับให้พอดีหน้า</span></button>
            <button type="button" className="od-icon-button" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)} title="แสดงเส้นตาราง"><Grid3x3 size={18} aria-hidden="true" /><span className="list-sr-only">แสดงเส้นตาราง</span></button>
            {!readOnly && <button type="button" className="od-icon-button" aria-pressed={snap} onClick={() => setSnap(v => !v)} title={`จัดตามเส้นตาราง ${doc.grid?.spacing || 5} มม.`}><Magnet size={18} aria-hidden="true" /><span className="list-sr-only">จัดวางตามเส้นตาราง</span></button>}
            {readOnly && <span className="od-viewbar-note"><Eye size={16} aria-hidden="true" /> ดูอย่างเดียว · คลิกวัตถุเพื่อดูข้อมูล</span>}
          </div>
          <DrawingCanvas ref={canvasRef} doc={doc} readOnly={readOnly} tool={readOnly ? 'select' : tool} toolOptions={toolOptions} activeLayerId={layerValid}
            selection={liveSelection} onSelect={setSelection} onCommit={commitDoc} onToolDone={() => setTool('select')}
            onMessage={(m) => toast.error(m, { id: 'od-tool' })}
            scale={scale} onScale={setScale} showGrid={showGrid} snap={snap} axisLock={axisLock}
            cableStyles={caps.cableStyles} linkStates={linkStates} siteName={siteName} />
        </div>
        <aside className="od-panel" aria-label="คุณสมบัติ">
          <DrawingInspector doc={doc} meta={meta} selection={liveSelection} readOnly={readOnly} onDoc={commitDoc} onMeta={commitMeta}
            cableStyles={caps.cableStyles} symbolKeys={caps.symbolKeys} limits={caps.limits}
            linkFor={linkFor} canLink={canLink} linksError={linksError} onRetryLinks={onRetryLinks}
            onPick={(o) => setPicker(o)} onDelete={requestDelete} onDuplicate={duplicate}
            activeLayerId={layerValid} onActiveLayer={setActiveLayerId} />
        </aside>
      </div>

      {picker && (
        <EquipmentLinkPicker siteId={siteId} token={token} initialKind={picker.asset_ref?.kind || (picker.type === 'equipment' && ['switch', 'router', 'firewall', 'access_point'].includes(picker.symbol_key) ? 'network_device' : 'office_equipment')}
          onClose={() => setPicker(null)}
          onPick={(asset) => {
            const id = picker.id;
            setPicker(null);
            onAssetPicked(asset);
            commitDoc({ ...doc, objects: doc.objects.map(o => (o.id === id ? { ...o, asset_ref: { kind: asset.kind, id: asset.id }, ...(o.label ? {} : { label: String(asset.label || '').slice(0, 500) }) } : o)) });
          }} />
      )}
      <ConfirmDialog open={Boolean(confirmDelete)} tone="danger" title="ลบวัตถุที่มีสายต่ออยู่"
        message={confirmDelete && <>มีแนวสาย {confirmDelete.cables} เส้นต่อกับวัตถุที่จะลบ เลือกว่าจะเก็บเส้นไว้ (ถอดปลายที่ต่อ) หรือลบเส้นด้วย<br />
          <button type="button" className="list-button" style={{ marginTop: 12 }} onClick={() => { commitDoc(deleteObjects(doc, confirmDelete.ids, { cables: 'detach' })); setConfirmDelete(null); setSelection([]); }}>ลบวัตถุ เก็บเส้นไว้</button></>}
        confirmLabel="ลบพร้อมเส้นที่ต่อ" onCancel={() => setConfirmDelete(null)}
        onConfirm={() => { commitDoc(deleteObjects(doc, confirmDelete.ids, { cables: 'delete' })); setConfirmDelete(null); setSelection([]); }} />
      {printOpen && <DrawingPrintPreview doc={doc} cableStyles={caps.cableStyles} siteName={siteName} title={meta.name} onClose={() => setPrintOpen(false)} />}
    </div>
  );
}
