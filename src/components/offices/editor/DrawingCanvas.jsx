import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import DrawingSheet from '../rendering/DrawingRenderer.jsx';
import {
  createBox, createDimension, createPolyline, allIds, isBox, isPolyline, legendRect, round, DEFAULT_SIZES, DIMENSION_ANCHORS
} from '../officeDrawingDocument.js';
import {
  anchorPoint, boxCorners, hitTest, insertVertex, removeVertex, lockAxis, moveObjects, moveVertex, nearestAnchor, objectsInRect,
  rectFromDrag, resizeBox, resizeBoxKeepRatio, rotationFromPointer, snapPoint, updateBox, boxCenter, findSnap, snapMove
} from '../officeDrawingGeometry.js';
import { dimensionGeometry, formatPaper, isScaledDoc, polylineLength, sizeLabel } from '../officeDrawingMeasure.js';

import { LINE_TOOLS, PLACE_TOOLS, RECT_TOOLS } from './editorTools.js';
const HANDLE_PX = 9;
const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

const handlePoint = (b, dir) => {
  const x = { w: b.x, e: b.x + b.width }[dir.replace(/[ns]/g, '')] ?? b.x + b.width / 2;
  const y = { n: b.y, s: b.y + b.height }[dir.replace(/[ew]/g, '')] ?? b.y + b.height / 2;
  return { x, y };
};

// The sheet plus every pointer interaction. A gesture edits a preview copy
// of the document; only its end commits one history entry (onCommit).
// Pan, zoom, selection and the preview never touch history or dirty state.
export default function DrawingCanvas({
  ref, doc, readOnly, tool, toolOptions, activeLayerId, selection, onSelect, onCommit, onToolDone, onMessage,
  scale, onScale, showGrid, snap, axisLock, cableStyles, linkStates, siteName, imageSources, onDropFiles
}) {
  const scrollRef = useRef(null);
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [preview, setPreview] = useState(null);      // document while dragging
  const [overlay, setOverlay] = useState(null);      // marquee / new rect / line draft
  const [hover, setHover] = useState(null);          // cable tool: box + anchor under pointer
  const [panning, setPanning] = useState(false);
  const [snapMark, setSnapMark] = useState(null);     // object snap shown under the pointer
  // The preview shown last, committed at pointer up (state may lag a frame).
  const lastPreview = useRef(null);
  const showPreview = (d) => { lastPreview.current = d; setPreview(d); };
  const shown = preview || doc;
  const sn = (p) => (snap ? snapPoint(p, { snap: true, spacing: doc.grid?.spacing || 5 }) : { x: round(p.x), y: round(p.y) });
  // Object snap (other lines' ends/bends/segments, box corners/edges/centre)
  // wins over the grid when the pointer is within a few screen pixels.
  const snapTol = 9 / scale;
  const objSnap = (p, exclude = null, extraPoints = []) => {
    if (!snap) return null;
    const s = findSnap(doc, p, { tolerance: snapTol, exclude, extraPoints });
    // Along a line, prefer the grid point when it lies on that same line.
    if (s?.kind === 'segment') {
      const g = sn(p);
      const on = findSnap(doc, g, { tolerance: 0.05, exclude });
      if (on && on.objectId === s.objectId && Math.hypot(g.x - p.x, g.y - p.y) <= snapTol) return { ...s, x: g.x, y: g.y };
    }
    return s;
  };
  const snapAll = (p, exclude = null) => { const s = objSnap(p, exclude); return s ? { x: s.x, y: s.y } : sn(p); };

  const toDoc = (e) => {
    const svg = svgRef.current;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  };

  const fit = () => {
    const el = scrollRef.current;
    if (!el) return;
    const s = Math.min((el.clientWidth - 48) / doc.page.width, (el.clientHeight - 48) / doc.page.height);
    onScale(Math.max(0.5, Math.min(12, s)));
  };
  // Fit the page once on first show.
  const fitted = useRef(false);
  useEffect(() => { if (!fitted.current) { fitted.current = true; fit(); } });

  // Ctrl/⌘ + wheel zooms around the pointer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ox = e.clientX - rect.left + el.scrollLeft;
      const oy = e.clientY - rect.top + el.scrollTop;
      const next = Math.max(0.5, Math.min(12, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const k = next / scale;
      onScale(next);
      requestAnimationFrame(() => { el.scrollLeft = ox * k - (e.clientX - rect.left); el.scrollTop = oy * k - (e.clientY - rect.top); });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale, onScale]);

  function cancelGesture() {
    const g = gesture.current;
    gesture.current = null;
    lastPreview.current = null;
    setPreview(null);
    setHover(null);
    setSnapMark(null);
    if (g?.kind === 'line' || overlay) setOverlay(null);
    return Boolean(g);
  }

  // Finish a wall/cable being drawn (Enter / double-click).
  function finishLine() {
    const g = gesture.current;
    if (!g || g.kind !== 'line') return false;
    const points = g.points;
    gesture.current = null;
    setOverlay(null);
    setHover(null);
    if (points.length < 2) { onMessage?.('เส้นต้องมีอย่างน้อย 2 จุด'); return true; }
    const taken = allIds(doc);
    const o = createPolyline(g.type, {
      points, layerId: activeLayerId, taken,
      ...(g.type === 'cable' ? { cable_style_key: toolOptions.cableStyle, start: g.start, end: g.end } : { thickness: toolOptions.wallThickness })
    });
    onCommit({ ...doc, objects: [...doc.objects, o] });
    onSelect([o.id]);
    return true;
  }

  // Paper point at the middle of what is on screen (where pasted images go).
  const viewCenter = () => {
    const el = scrollRef.current;
    const svg = svgRef.current;
    if (!el || !svg) return { x: doc.page.width / 2, y: doc.page.height / 2 };
    const r = el.getBoundingClientRect();
    const p = toDoc({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    return { x: clamp(p.x, doc.page.width), y: clamp(p.y, doc.page.height) };
  };

  useImperativeHandle(ref, () => ({ fit, cancel: cancelGesture, finishLine, viewCenter }));

  // Snap a dimension end to a box anchor (corners included) under the pointer.
  const dimPoint = (p, exclude) => {
    const box = boxUnder(p, exclude);
    if (!box) { const s = objSnap(p, exclude); return { q: s ? { x: s.x, y: s.y } : sn(p), ref: null, hover: null }; }
    const anchor = nearestAnchor(box, p, DIMENSION_ANCHORS);
    const a = anchorPoint(box, anchor);
    return { q: { x: round(a.x), y: round(a.y) }, ref: { object_id: box.id, anchor }, hover: { box, anchor } };
  };
  const dimAxis = (a, b, force) => {
    if (!force) return 'aligned';
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : 'vertical';
  };

  const layerUsable = () => {
    const layer = doc.layers.find(l => l.id === activeLayerId);
    if (!layer) { onMessage?.('กรุณาเลือกชั้นที่จะวาด'); return false; }
    if (layer.locked || layer.visible === false) { onMessage?.(`ชั้น “${layer.name}” ถูก${layer.locked ? 'ล็อก' : 'ซ่อน'}อยู่ เปิดก่อนจึงวาดได้`); return false; }
    return true;
  };

  const boxUnder = (p, exclude) => hitTest(doc, p, { boxesOnly: true, exclude, tolerance: 2 / scale * 3 });

  const onPointerDown = (e) => {
    if (e.button === 1 || tool === 'pan' || (e.button === 0 && e.altKey)) {
      const el = scrollRef.current;
      gesture.current = { kind: 'pan', x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = toDoc(e);
    const tol = Math.max(1, 6 / scale);

    if (readOnly) {
      const hit = hitTest(doc, p, { includeLocked: true, tolerance: tol });
      onSelect(hit ? [hit.id] : []);
      return;
    }

    const handle = e.target.closest?.('[data-handle]')?.getAttribute('data-handle');
    // Handles belong to the select tool; while drawing, a click is a new point.
    if (handle && tool === 'select' && selection.length === 1) {
      const o = doc.objects.find(x => x.id === selection[0]);
      if (o) {
        const [kind, arg] = handle.split(':');
        if (kind === 'mid') {
          const i = Number(arg);
          const inserted = insertVertex(o, i, sn(p));
          const base = { ...doc, objects: doc.objects.map(x => (x.id === o.id ? inserted : x)) };
          gesture.current = { kind: 'vertex', id: o.id, index: i, base, orig: inserted };
        } else {
          gesture.current = { kind, arg, index: kind === 'vertex' ? Number(arg) : null, id: o.id, base: doc, orig: o, start: p };
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (handle === 'legend' && tool === 'select') {
      gesture.current = { kind: 'legend', base: doc, start: p, orig: { x: doc.legend.x, y: doc.legend.y } };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'dimension') {
      if (!isScaledDoc(doc)) { onMessage?.('เส้นบอกระยะใช้ได้เมื่อกำหนดมาตราส่วนของแบบแล้ว (แผงขวา > มาตราส่วน)'); return; }
      if (!layerUsable()) return;
      const { q, ref } = dimPoint(p);
      const g = gesture.current?.kind === 'dim' ? gesture.current : null;
      if (!g) {
        gesture.current = { kind: 'dim', start: q, startRef: ref };
        setOverlay({ kind: 'dim', start: q, end: q });
        return;
      }
      if (q.x === g.start.x && q.y === g.start.y) return;
      const axis = dimAxis(g.start, q, axisLock || e.shiftKey);
      const o = createDimension({ start: g.start, end: q, axis, offset: axis === 'vertical' ? -6 : axis === 'horizontal' ? -6 : 6, layerId: activeLayerId, taken: allIds(doc), startRef: g.startRef, endRef: ref });
      gesture.current = null;
      setOverlay(null);
      setHover(null);
      if (!(axis === 'horizontal' ? Math.abs(q.x - g.start.x) : axis === 'vertical' ? Math.abs(q.y - g.start.y) : 1)) { onMessage?.('จุดปลายต้องห่างกันตามแนวที่วัด'); return; }
      onCommit({ ...doc, objects: [...doc.objects, o] });
      onSelect([o.id]);
      return;
    }

    if (LINE_TOOLS.includes(tool)) {
      if (!layerUsable()) return;
      const g = gesture.current?.kind === 'line' ? gesture.current : null;
      if (e.detail >= 2 && g) { finishLine(); return; }
      let q = sn(p);
      let ref = null;
      let joins = false;
      if (tool === 'cable') {
        const box = boxUnder(p);
        if (box) { const anchor = nearestAnchor(box, p); const a = anchorPoint(box, anchor); q = { x: round(a.x), y: round(a.y) }; ref = { object_id: box.id, anchor }; }
      }
      if (!ref) {
        // Back on its own first point closes the shape.
        const close = g && g.points.length >= 2 ? [{ point: g.points[0], kind: 'close' }] : [];
        const s = objSnap(p, null, close);
        if (s) { q = { x: s.x, y: s.y }; joins = Boolean(g) && ['vertex', 'segment', 'close'].includes(s.kind); }
        else if (g && (axisLock || e.shiftKey)) q = lockAxis(g.points[g.points.length - 1], q);
      }
      if (!g) {
        gesture.current = { kind: 'line', type: tool, points: [q], start: ref, end: null };
      } else {
        const last = g.points[g.points.length - 1];
        if (last.x === q.x && last.y === q.y) return;
        gesture.current = { ...g, points: [...g.points, q], end: ref };
        // One click is enough when the line ends on a box (cable) or meets
        // another line / its own start: no double-click needed.
        if ((tool === 'cable' && ref) || joins) { setSnapMark(null); finishLine(); return; }
      }
      setOverlay({ kind: 'line', points: gesture.current.points, cursor: q });
      return;
    }

    if (PLACE_TOOLS.includes(tool)) {
      if (!layerUsable()) return;
      const [w, h] = DEFAULT_SIZES[tool];
      const c = sn(p);
      const o = createBox(tool, { x: c.x - w / 2, y: c.y - h / 2, layerId: activeLayerId, taken: allIds(doc), symbol_key: toolOptions.symbol[tool] });
      onCommit({ ...doc, objects: [...doc.objects, o] });
      onSelect([o.id]);
      return;
    }

    if (RECT_TOOLS.includes(tool)) {
      if (!layerUsable()) return;
      const a = snapAll(p);
      gesture.current = { kind: 'create', type: tool, a };
      setOverlay({ kind: 'rect', ...rectFromDrag(a, a, 0) });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // select tool
    if (doc.legend?.visible !== false && doc.legend?.items?.length) {
      const r = legendRect(doc.legend);
      if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height && !hitTest(doc, p, { tolerance: tol })) {
        onSelect(['__legend']);
        gesture.current = { kind: 'legend', base: doc, start: p, orig: { x: doc.legend.x, y: doc.legend.y } };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    const hit = hitTest(doc, p, { tolerance: tol });
    if (hit) {
      if (e.shiftKey) { onSelect(selection.includes(hit.id) ? selection.filter(id => id !== hit.id) : [...selection.filter(id => id !== '__legend'), hit.id]); return; }
      const ids = selection.includes(hit.id) ? selection.filter(id => id !== '__legend') : [hit.id];
      if (!selection.includes(hit.id)) onSelect(ids);
      gesture.current = { kind: 'move', ids, base: doc, start: p, anchorObj: hit };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    gesture.current = { kind: 'marquee', start: p, add: e.shiftKey };
    setOverlay({ kind: 'marquee', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) {
      if (!readOnly && tool === 'cable') {
        const p = toDoc(e);
        const box = boxUnder(p);
        setHover(box ? { box, anchor: nearestAnchor(box, p) } : null);
      }
      if (!readOnly && tool === 'dimension') setHover(dimPoint(toDoc(e)).hover);
      if (!readOnly && tool !== 'select' && tool !== 'pan') setSnapMark(objSnap(toDoc(e)));
      return;
    }
    if (g.kind === 'dim') {
      const { q, hover: hv } = dimPoint(toDoc(e));
      setHover(hv);
      setOverlay({ kind: 'dim', start: g.start, end: q, axis: dimAxis(g.start, q, axisLock || e.shiftKey) });
      return;
    }
    if (g.kind === 'pan') {
      const el = scrollRef.current;
      el.scrollLeft = g.left - (e.clientX - g.x);
      el.scrollTop = g.top - (e.clientY - g.y);
      return;
    }
    const p = toDoc(e);
    if (g.kind === 'line') {
      let q = sn(p);
      let hv = null;
      if (g.type === 'cable') {
        const box = boxUnder(p);
        if (box) { const anchor = nearestAnchor(box, p); const a = anchorPoint(box, anchor); q = a; hv = { box, anchor }; }
      }
      let mark = null;
      if (!hv) {
        const close = g.points.length >= 2 ? [{ point: g.points[0], kind: 'close' }] : [];
        const s = objSnap(p, null, close);
        if (s) { q = { x: s.x, y: s.y }; mark = s; }
        else if (axisLock || e.shiftKey) q = lockAxis(g.points[g.points.length - 1], q);
      }
      setHover(hv);
      setSnapMark(mark);
      setOverlay({ kind: 'line', points: g.points, cursor: q });
      return;
    }
    if (g.kind === 'marquee') { setOverlay({ kind: 'marquee', x1: g.start.x, y1: g.start.y, x2: p.x, y2: p.y }); return; }
    if (g.kind === 'create') { setSnapMark(objSnap(p)); setOverlay({ kind: 'rect', ...rectFromDrag(g.a, snapAll(p), 0) }); return; }
    if (g.kind === 'move') {
      let dx = p.x - g.start.x;
      let dy = p.y - g.start.y;
      // A click (or a jitter) is not a move: nothing shifts, nothing snaps.
      if (!g.dragging && Math.hypot(dx, dy) * scale < 3) { lastPreview.current = null; setPreview(null); return; }
      g.dragging = true;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const ref = g.anchorObj;
      const os = snap && !e.altKey ? snapMove(g.base, g.ids, dx, dy, snapTol) : null;
      if (os) {
        setSnapMark(os.snap);
        showPreview(moveObjects(g.base, g.ids, round(os.dx), round(os.dy)));
        return;
      }
      setSnapMark(null);
      if (snap && isBox(ref)) {
        const target = sn({ x: ref.x + dx, y: ref.y + dy });
        dx = target.x - ref.x; dy = target.y - ref.y;
      } else if (snap) { const s = doc.grid?.spacing || 5; dx = Math.round(dx / s) * s; dy = Math.round(dy / s) * s; }
      showPreview(moveObjects(g.base, g.ids, round(dx), round(dy)));
      return;
    }
    if (g.kind === 'legend') {
      const t = sn({ x: g.orig.x + p.x - g.start.x, y: g.orig.y + p.y - g.start.y });
      showPreview({ ...g.base, legend: { ...g.base.legend, x: t.x, y: t.y } });
      return;
    }
    if (g.kind === 'resize') {
      // Images keep their proportions unless Shift is held.
      const r = g.orig.type === 'image' && !e.shiftKey ? resizeBoxKeepRatio(g.orig, g.arg, sn(p)) : resizeBox(g.orig, g.arg, sn(p));
      showPreview(updateBox(g.base, g.id, r));
      return;
    }
    if (g.kind === 'dimpt') {
      const key = g.arg;
      const { q, ref, hover: hv } = dimPoint(p, new Set([g.id]));
      setHover(hv);
      const moved = { ...g.orig, [key]: q, [`${key}_ref`]: ref };
      showPreview({ ...g.base, objects: g.base.objects.map(x => (x.id === g.id ? moved : x)) });
      return;
    }
    if (g.kind === 'dimoff') {
      const o = g.orig;
      let offset;
      if (o.axis === 'horizontal') offset = p.y - o.start.y;
      else if (o.axis === 'vertical') offset = p.x - o.start.x;
      else {
        const len = Math.hypot(o.end.x - o.start.x, o.end.y - o.start.y) || 1;
        offset = ((p.x - o.start.x) * -(o.end.y - o.start.y) + (p.y - o.start.y) * (o.end.x - o.start.x)) / len;
      }
      const moved = { ...o, offset: round(offset) };
      showPreview({ ...g.base, objects: g.base.objects.map(x => (x.id === g.id ? moved : x)) });
      return;
    }
    if (g.kind === 'rotate') { showPreview(updateBox(g.base, g.id, { rotation: rotationFromPointer(g.orig, p, e.shiftKey ? 1 : 15) })); return; }
    if (g.kind === 'vertex') {
      const o = g.orig;
      let q = sn(p);
      const isEnd = g.index === 0 || g.index === o.points.length - 1;
      let changes = {};
      if (o.type === 'cable' && isEnd) {
        const box = boxUnder(p, new Set([o.id]));
        const key = g.index === 0 ? 'start' : 'end';
        if (box) { const anchor = nearestAnchor(box, p); const a = anchorPoint(box, anchor); q = a; changes = { [key]: { object_id: box.id, anchor } }; setHover({ box, anchor }); } else { changes = { [key]: null }; setHover(null); }
      }
      if (!changes.start && !changes.end) {
        const s = objSnap(p, new Set([o.id]));
        setSnapMark(s);
        if (s) q = { x: s.x, y: s.y };
        else if (axisLock || e.shiftKey) {
          const nb = o.points[g.index === 0 ? 1 : g.index - 1];
          q = lockAxis(nb, q);
        }
      }
      const moved = { ...moveVertex(o, g.index, q), ...changes };
      showPreview({ ...g.base, objects: g.base.objects.map(x => (x.id === o.id ? moved : x)) });
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    if (!g || g.kind === 'line' || g.kind === 'dim') return;
    // The release point counts even if its last move event was coalesced.
    if (['move', 'legend', 'resize', 'rotate', 'vertex', 'dimpt', 'dimoff'].includes(g.kind)) onPointerMove(e);
    gesture.current = null;
    if (g.kind === 'pan') { setPanning(false); return; }
    if (g.kind === 'marquee') {
      const p = toDoc(e);
      setOverlay(null);
      const tiny = Math.abs(p.x - g.start.x) * scale < 4 && Math.abs(p.y - g.start.y) * scale < 4;
      if (tiny) { if (!g.add) onSelect([]); return; }
      const ids = objectsInRect(doc, { x1: g.start.x, y1: g.start.y, x2: p.x, y2: p.y });
      onSelect(g.add ? [...new Set([...selection, ...ids])] : ids);
      return;
    }
    if (g.kind === 'create') {
      const b = toDoc(e);
      setOverlay(null);
      const dragged = Math.abs(b.x - g.a.x) * scale > 6 || Math.abs(b.y - g.a.y) * scale > 6;
      const r = dragged ? rectFromDrag(g.a, snapAll(b)) : { x: g.a.x, y: g.a.y };
      setSnapMark(null);
      const o = createBox(g.type, { ...r, layerId: activeLayerId, taken: allIds(doc) });
      onCommit({ ...doc, objects: [...doc.objects, o] });
      onSelect([o.id]);
      onToolDone?.();
      return;
    }
    setHover(null);
    setSnapMark(null);
    if (lastPreview.current) onCommit(lastPreview.current);
    lastPreview.current = null;
    setPreview(null);
  };

  const onPointerCancel = () => { setPanning(false); if (gesture.current?.kind !== 'line') cancelGesture(); };

  // ---- overlay: selection, handles, previews ----
  const hs = HANDLE_PX / scale;
  const sel = selection.map(id => shown.objects.find(o => o.id === id)).filter(Boolean);
  const single = sel.length === 1 ? sel[0] : null;
  const layerOk = (o) => { const l = shown.layers.find(x => x.id === o.layer_id); return l && !l.locked && l.visible !== false; };
  const handles = !readOnly && tool === 'select' && single && layerOk(single) && !preview;
  const legendSelected = selection.includes('__legend') && shown.legend;

  const outline = (o) => {
    if (o.type === 'dimension') {
      const d = dimensionGeometry(o);
      return <polyline key={o.id} points={[o.start, d.a, d.b, o.end].map(p => `${p.x},${p.y}`).join(' ')} className="od-sel od-sel-line" />;
    }
    if (isBox(o)) {
      const pts = boxCorners(o).map(p => `${p.x},${p.y}`).join(' ');
      return <polygon key={o.id} points={pts} className="od-sel" />;
    }
    return <polyline key={o.id} points={o.points.map(p => `${p.x},${p.y}`).join(' ')} className="od-sel od-sel-line" />;
  };

  const lineDraft = overlay?.kind === 'line' ? [...overlay.points, overlay.cursor].filter(Boolean) : null;

  // Live real-size label (scaled drawings only), fixed size on screen.
  let measure = null;
  if (isScaledDoc(doc)) {
    if (overlay?.kind === 'rect' && (overlay.width > 0 || overlay.height > 0)) measure = { at: { x: overlay.x + overlay.width, y: overlay.y + overlay.height }, text: sizeLabel(overlay.width, overlay.height, doc) };
    else if (lineDraft && lineDraft.length > 1) {
      const last = lineDraft.slice(-2);
      measure = { at: last[1], text: `${formatPaper(polylineLength(last), doc)} · รวม ${formatPaper(polylineLength(lineDraft), doc)}` };
    } else if (overlay?.kind === 'dim') {
      const len = overlay.axis === 'horizontal' ? Math.abs(overlay.end.x - overlay.start.x) : overlay.axis === 'vertical' ? Math.abs(overlay.end.y - overlay.start.y) : Math.hypot(overlay.end.x - overlay.start.x, overlay.end.y - overlay.start.y);
      measure = { at: overlay.end, text: formatPaper(len, doc) };
    } else if (preview && single && isBox(single)) {
      measure = { at: { x: single.x + single.width, y: single.y + single.height }, text: sizeLabel(single.width, single.height, doc) };
    } else if (preview && single && isPolyline(single)) {
      measure = { at: single.points[single.points.length - 1], text: `รวม ${formatPaper(polylineLength(single.points), doc)}` };
    } else if (preview && single?.type === 'dimension') {
      measure = null; // the dimension's own label already updates live
    }
  }
  const fs = 11 / scale;
  const cursor = readOnly ? 'default' : tool === 'pan' ? (panning ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div ref={scrollRef} className={`od-canvas${readOnly ? ' is-readonly' : ''}`}
      onDragOver={readOnly || !onDropFiles ? undefined : (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); }}
      onDrop={readOnly || !onDropFiles ? undefined : (e) => {
        const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        onDropFiles(files, toDoc(e));
      }}>
      <div className="od-canvas-inner">
        <DrawingSheet doc={shown} cableStyles={cableStyles} siteName={siteName} mode="edit" scale={scale} showGrid={showGrid} linkStates={linkStates} imageSources={imageSources} svgRef={svgRef}
          svgProps={{
            onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
            onDoubleClick: (e) => {
              if (finishLine() || readOnly) return;
              // Double-click a bend to remove it (a line keeps at least 2 points).
              const h = e.target.closest?.('[data-handle]')?.getAttribute('data-handle');
              if (h?.startsWith('vertex:') && single && isPolyline(single) && single.points.length > 2) {
                const i = Number(h.split(':')[1]);
                onCommit({ ...doc, objects: doc.objects.map(o => (o.id === single.id ? removeVertex(o, i) : o)) });
              }
            },
            style: { cursor, touchAction: readOnly ? 'auto' : 'none' }
          }}>
          <g className="od-overlay">
            {sel.map(outline)}
            {legendSelected && (() => { const r = legendRect(shown.legend); return <rect x={r.x} y={r.y} width={r.width} height={r.height} className="od-sel" data-handle={readOnly ? undefined : 'legend'} />; })()}
            {handles && isBox(single) && (
              <>
                {(() => {
                  const c = boxCenter(single);
                  const top = anchorPoint(single, 'top');
                  const k = { x: top.x + (top.x - c.x) / Math.max(1, Math.hypot(top.x - c.x, top.y - c.y)) * hs * 2.5, y: top.y + (top.y - c.y) / Math.max(1, Math.hypot(top.x - c.x, top.y - c.y)) * hs * 2.5 };
                  return (
                    <g>
                      <line x1={top.x} y1={top.y} x2={k.x} y2={k.y} className="od-handle-stem" />
                      <circle cx={k.x} cy={k.y} r={hs / 1.6} className="od-handle od-handle-rotate" data-handle="rotate" style={{ cursor: 'grab' }}><title>หมุน (Shift = ทีละ 1°)</title></circle>
                    </g>
                  );
                })()}
                {RESIZE_DIRS.map(dir => {
                  const p = boxCenter(single);
                  const local = handlePoint(single, dir);
                  const r = (single.rotation || 0) * Math.PI / 180;
                  const q = { x: p.x + (local.x - p.x) * Math.cos(r) - (local.y - p.y) * Math.sin(r), y: p.y + (local.x - p.x) * Math.sin(r) + (local.y - p.y) * Math.cos(r) };
                  return <rect key={dir} x={q.x - hs / 2} y={q.y - hs / 2} width={hs} height={hs} className="od-handle" data-handle={`resize:${dir}`} style={{ cursor: CURSORS[dir] }} />;
                })}
              </>
            )}
            {handles && single.type === 'dimension' && (() => {
              const d = dimensionGeometry(single);
              return (
                <>
                  <rect x={single.start.x - hs / 2} y={single.start.y - hs / 2} width={hs} height={hs} className="od-handle od-handle-end" data-handle="dimpt:start"><title>ลากเพื่อย้ายจุดเริ่ม (วางบนวัตถุเพื่อยึดติด)</title></rect>
                  <rect x={single.end.x - hs / 2} y={single.end.y - hs / 2} width={hs} height={hs} className="od-handle od-handle-end" data-handle="dimpt:end"><title>ลากเพื่อย้ายจุดปลาย</title></rect>
                  <circle cx={d.mid.x} cy={d.mid.y} r={hs / 2} className="od-handle od-handle-mid" data-handle="dimoff" style={{ cursor: 'move' }}><title>ลากเพื่อเลื่อนเส้นบอกระยะออกจากวัตถุ</title></circle>
                </>
              );
            })()}
            {handles && isPolyline(single) && (
              <>
                {single.points.slice(1).map((pt, i) => {
                  const a = single.points[i];
                  if (single.points.length >= 500) return null;
                  return <circle key={`m${i}`} cx={(a.x + pt.x) / 2} cy={(a.y + pt.y) / 2} r={hs / 2.6} className="od-handle od-handle-mid" data-handle={`mid:${i + 1}`}><title>ลากเพื่อเพิ่มจุดหักมุม</title></circle>;
                })}
                {single.points.map((pt, i) => (
                  <rect key={`v${i}`} x={pt.x - hs / 2} y={pt.y - hs / 2} width={hs} height={hs} className={`od-handle${(i === 0 || i === single.points.length - 1) && single.type === 'cable' ? ' od-handle-end' : ''}`} data-handle={`vertex:${i}`} />
                ))}
              </>
            )}
            {overlay?.kind === 'marquee' && <rect x={Math.min(overlay.x1, overlay.x2)} y={Math.min(overlay.y1, overlay.y2)} width={Math.abs(overlay.x2 - overlay.x1)} height={Math.abs(overlay.y2 - overlay.y1)} className="od-marquee" />}
            {overlay?.kind === 'rect' && <rect x={overlay.x} y={overlay.y} width={Math.max(overlay.width, 0.1)} height={Math.max(overlay.height, 0.1)} className="od-marquee" />}
            {lineDraft && lineDraft.length > 0 && (
              <>
                <polyline points={lineDraft.map(p => `${p.x},${p.y}`).join(' ')} className="od-draft-line" />
                {overlay.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={hs / 3} className="od-draft-point" />)}
              </>
            )}
            {overlay?.kind === 'dim' && <line x1={overlay.start.x} y1={overlay.start.y} x2={overlay.end.x} y2={overlay.end.y} className="od-draft-line" />}
            {hover && (() => { const a = anchorPoint(hover.box, hover.anchor); return <circle cx={a.x} cy={a.y} r={hs / 1.8} className="od-anchor-hint" />; })()}
            {snapMark && !hover && (
              snapMark.kind === 'segment'
                ? <path d={`M ${snapMark.x - hs / 2} ${snapMark.y - hs / 2} L ${snapMark.x + hs / 2} ${snapMark.y + hs / 2} M ${snapMark.x - hs / 2} ${snapMark.y + hs / 2} L ${snapMark.x + hs / 2} ${snapMark.y - hs / 2}`} className="od-snap-mark" />
                : <rect x={snapMark.x - hs / 2} y={snapMark.y - hs / 2} width={hs} height={hs} className={`od-snap-mark${snapMark.kind === 'close' ? ' is-close' : ''}`} />
            )}
            {measure?.text && (
              <g className="od-measure" transform={`translate(${measure.at.x + fs * 0.8} ${measure.at.y + fs * 0.8})`}>
                <rect x="0" y="0" width={[...measure.text].length * fs * 0.56 + fs} height={fs * 1.6} rx={fs * 0.3} />
                <text x={fs * 0.5} y={fs * 1.15} fontSize={fs}>{measure.text}</text>
              </g>
            )}
          </g>
        </DrawingSheet>
      </div>
    </div>
  );
}
