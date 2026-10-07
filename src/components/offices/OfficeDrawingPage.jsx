import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, History, Loader2, LogIn, PencilRuler, RefreshCw, Download } from 'lucide-react';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import '../equipment-form/ConfirmDialog.css';
import { BUSY_LEAVE_MESSAGE, clearNavigationGuard, useLeaveGuard } from '../../navigationGuard';
import { claimSessionEnd } from '../../authSession';
import {
  TYPE_LABELS, createDrawing, deleteDrawing, downloadJson, entryFromDrawing, formatWhen, request, roleCanEdit, updateDrawing, urls, writablePayload
} from './officeDrawingApi.js';
import {
  DEFAULT_CABLE_STYLES, DEFAULT_LIMITS, byteLength, objectIndexFromPath, sameJson, unknownObjects, validateDrawing
} from './officeDrawingDocument.js';
import { acceptSaved, canRedo, canUndo, commit, createHistory, isDirty, redo, undo } from './officeDrawingHistory.js';
import { TEMPLATES, templateDocument } from './officeDrawingTemplates.js';
import { clearRecovery, readRecovery, saveRecovery } from './officeDrawingRecovery.js';
import { useDrawingResource, useSiteInfo } from './officeHooks.js';
import { PageError } from './Offices.jsx';
import DrawingEditor from './editor/DrawingEditor.jsx';
import DuplicateDrawingDialog from './DuplicateDrawingDialog.jsx';
import '../ListPage.css';
import './Offices.css';

const DEFAULT_SYMBOLS = {
  equipment: ['pc', 'notebook', 'printer', 'scanner', 'switch', 'router', 'firewall', 'access_point', 'rack', 'server', 'ups', 'cctv', 'ip_phone', 'generic'],
  outlet: ['outlet', 'outlet_lan', 'outlet_fiber', 'outlet_phone', 'outlet_power']
};

function capsFrom(data) {
  return {
    cableStyles: data?.cable_styles?.length ? data.cable_styles : DEFAULT_CABLE_STYLES,
    symbolKeys: { ...DEFAULT_SYMBOLS, legend: [...DEFAULT_SYMBOLS.equipment, ...DEFAULT_SYMBOLS.outlet, 'junction'], ...(data?.symbol_keys || {}) },
    limits: { ...DEFAULT_LIMITS, ...(data?.limits || {}) },
    schemaVersions: data?.schema_versions || [1]
  };
}

// Template, paper and names for a drawing that does not exist yet. Nothing
// is sent to the server until the first save.
function NewDrawingForm({ siteName, onStart, onCancel }) {
  const [template, setTemplate] = useState('blank');
  const [size, setSize] = useState('A4');
  const [orientation, setOrientation] = useState('landscape');
  const [type, setType] = useState('floor_plan');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const t = TEMPLATES.find(x => x.key === template);
  const start = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const drawingType = t.drawingType || type;
    onStart({
      meta: { name: name.trim(), drawing_type: drawingType, building_label: building.trim() || null, floor_label: floor.trim() || null },
      doc: templateDocument(template, { size, orientation, drawingType })
    });
  };
  return (
    <form className="list-panel od-new" onSubmit={start}>
      <h2>สร้างแบบใหม่ · {siteName}</h2>
      <fieldset className="od-templates">
        <legend>เริ่มจาก</legend>
        {TEMPLATES.map(x => (
          <label key={x.key} className={`od-template${template === x.key ? ' is-active' : ''}`}>
            <input type="radio" name="od-template" value={x.key} checked={template === x.key} onChange={() => setTemplate(x.key)} />
            <strong>{x.label}</strong>
            <span className="list-muted">{x.desc}{x.size ? ` · ${x.size} ${x.orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}` : ''}</span>
          </label>
        ))}
      </fieldset>
      {template === 'blank' && (
        <div className="od-new-grid">
          <label className="od-field">ชนิดแบบ<select value={type} onChange={e => setType(e.target.value)}>{Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="od-field">ขนาดกระดาษ<select value={size} onChange={e => setSize(e.target.value)}><option value="A4">A4</option><option value="A3">A3</option></select></label>
          <label className="od-field">แนวกระดาษ<select value={orientation} onChange={e => setOrientation(e.target.value)}><option value="landscape">แนวนอน</option><option value="portrait">แนวตั้ง</option></select></label>
        </div>
      )}
      <div className="od-new-grid">
        <label className="od-field">ชื่อแบบ *<input value={name} maxLength={200} required onChange={e => setName(e.target.value)} placeholder="เช่น ผังห้องเครือข่าย ชั้น 2" /></label>
        <label className="od-field">อาคาร<input value={building} maxLength={200} onChange={e => setBuilding(e.target.value)} /></label>
        <label className="od-field">ชั้น<input value={floor} maxLength={200} onChange={e => setFloor(e.target.value)} /></label>
      </div>
      <p className="list-muted">แม่แบบมีเฉพาะรูปทรงและชื่อทั่วไป ไม่มีทะเบียนอุปกรณ์ติดมา ผูกอุปกรณ์จริงของสำนักงานนี้ได้ในหน้าวาด · ระบบยังไม่บันทึกจนกว่าจะกด “บันทึก”</p>
      <div className="od-inline-actions">
        <button type="button" className="list-button" onClick={onCancel}>ยกเลิก</button>
        <button type="submit" className="list-button list-button-primary" disabled={!name.trim()}><PencilRuler size={18} aria-hidden="true" /> เริ่มวาด</button>
      </div>
    </form>
  );
}

// Loads one drawing (or starts a new one), owns undo history, the saved
// baseline, saving, conflicts and what happens when the session ends.
export default function OfficeDrawingPage({ siteId, drawingId, token, user, onGo, onReplace, onRequireLogin }) {
  const site = useSiteInfo(siteId);
  const capsRes = useDrawingResource(urls.capabilities(), { token });
  const caps = capsFrom(capsRes.data);
  const isNewRoute = drawingId === 'new';
  const createdIdRef = useRef(null);
  const drawingRes = useDrawingResource(isNewRoute ? null : urls.drawing(drawingId), { token, enabled: !isNewRoute });
  const [session, setSession] = useState(null); // { id, history, baseline, server }
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [issue, setIssue] = useState(null);      // save problem banner
  const [focusId, setFocusId] = useState(null);
  const [picked, setPicked] = useState(() => new Map());
  const [linksNonce, setLinksNonce] = useState(0);
  const [dup, setDup] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);

  // Moving to another drawing (not the one just created from /new) starts over.
  const [forId, setForId] = useState(drawingId);
  if (forId !== drawingId) {
    setForId(drawingId);
    if (String(drawingId) !== createdIdRef.current) { setSession(null); setIssue(null); setFocusId(null); setRecoveryDismissed(false); }
  }
  // Only an answer for the current URL and session counts.
  const d = drawingRes.stale ? null : drawingRes.data;
  // A drawing (re)loaded from the server becomes the session when there is
  // none yet, when it is another drawing, or when nobody is editing and the
  // server has a newer version (a refetch after login, a reload).
  if (d && !isNewRoute) {
    const fresh = !session || (session.id !== null && String(session.id) !== String(d.id));
    // Only a strictly newer version: the first GET is older than our own saves.
    const newer = session && String(session.id) === String(d.id) && d.version > session.baseline.version && !isDirty(session.history, session.baseline) && !saving;
    if (fresh || newer) {
      const entry = entryFromDrawing(d);
      setSession({ id: d.id, history: createHistory(entry), baseline: { entry, version: d.version }, server: d });
    }
  }
  // Opened under the wrong office in the URL: go to the drawing's own path.
  const wrongSite = d && String(d.pea_site_id) !== String(siteId);
  useEffect(() => {
    if (wrongSite) {
      toast(`แบบนี้เป็นของ ${d.pea_site_name || `สำนักงาน ${d.pea_site_id}`} จึงเปิดในสำนักงานที่ถูกต้อง`, { icon: 'ℹ️' });
      onReplace(`/offices/${d.pea_site_id}/drawings/${d.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongSite]);

  const currentId = session?.id ?? null;
  const linksRes = useDrawingResource(currentId ? urls.links(currentId) : null, { token, enabled: Boolean(currentId), nonce: linksNonce });
  const links = linksRes.data;

  const entry = session?.history.present;
  const dirty = Boolean(session) && isDirty(session.history, session.baseline);
  const drawingKey = currentId ?? `new:${siteId}`;
  const roleOk = Boolean(token) && roleCanEdit(user);
  const perms = currentId ? (d?.permissions || null) : capsRes.data?.permissions;
  const schemaOk = !session?.server || caps.schemaVersions.includes(session.server.schema_version);
  const unknown = entry ? unknownObjects(entry.doc).length : 0;
  const canEdit = roleOk && Boolean(currentId ? perms?.can_edit : perms?.can_create) && schemaOk && !unknown;
  const siteName = site.site?.label || session?.server?.pea_site_name || d?.pea_site_name || '';
  const listPath = `/offices/${siteId}/drawings`;

  useLeaveGuard(dirty, { message: saving ? BUSY_LEAVE_MESSAGE : 'แบบนี้มีการแก้ไขที่ยังไม่บันทึก ถ้าออกจากหน้านี้การแก้ไขจะหายไป' });

  // Session ending (token expired, idle logout, logout): keep a recovery
  // copy while the user is still known, and stay on the page read-only.
  const latest = useRef({});
  useEffect(() => { latest.current = { dirty, entry, user, drawingKey, siteId, version: session?.baseline.version ?? null }; });
  useEffect(() => claimSessionEnd(() => {
    const s = latest.current;
    if (s.dirty && s.user?.id !== undefined) saveRecovery({ userId: s.user.id, drawingKey: s.drawingKey, siteId: s.siteId, version: s.version, entry: s.entry });
    return true;
  }), []);

  const setHistory = (fn) => setSession(s => (s ? { ...s, history: fn(s.history) } : s));
  const onCommit = (next) => { setIssue(i => (i?.kind === 'validation' ? null : i)); setHistory(h => commit(h, next)); };

  const recovery = user && session && !recoveryDismissed ? readRecovery({ userId: user.id, drawingKey }) : null;
  const showRecovery = recovery && !sameJson(recovery.entry, entry) && canEdit;

  const exportDraft = () => {
    if (!entry) return;
    downloadJson(`drawing-${currentId || 'new'}-${new Date().toISOString().slice(0, 10)}.json`, {
      exported_at: new Date().toISOString(), drawing_id: currentId, pea_site_id: Number(siteId), base_version: session.baseline.version, ...writablePayload(entry)
    });
  };

  const loginAgain = () => {
    if (dirty && user) saveRecovery({ userId: user.id, drawingKey, siteId, version: session.baseline.version, entry });
    clearNavigationGuard();
    onRequireLogin(window.location.pathname + window.location.search);
  };

  // ---- save ----
  const save = async () => {
    if (!session || savingRef.current || !canEdit) return;
    const snapshot = session.history.present;
    if (!dirty) { toast('ไม่มีการเปลี่ยนแปลงที่ต้องบันทึก', { id: 'od-nochange' }); return; }
    const problem = validateDrawing(snapshot, caps.limits);
    if (problem) { setIssue({ kind: 'validation', message: problem.message }); if (problem.objectId) setFocusId(problem.objectId); return; }
    const expected = session.baseline.version;
    const body = writablePayload(snapshot, currentId ? { expectedVersion: expected } : { siteId });
    if (byteLength(body) > caps.limits.max_request_bytes) { setIssue({ kind: 'error', message: 'แบบมีขนาดใหญ่เกิน 2 MB กรุณาลดจำนวนวัตถุหรือข้อความ' }); return; }
    savingRef.current = true;
    setSaving(true);
    setIssue(null);
    const r = currentId ? await updateDrawing(currentId, snapshot, expected, token) : await createDrawing(snapshot, siteId, token);
    savingRef.current = false;
    setSaving(false);
    if (r.ok) {
      const saved = r.data;
      setSession(s => ({ ...s, id: saved.id, server: saved, baseline: acceptSaved(snapshot, saved.version) }));
      if (user) clearRecovery({ userId: user.id, drawingKey });
      setLinksNonce(n => n + 1);
      toast.success(currentId ? `บันทึกแล้ว (ฉบับที่ ${saved.version})` : 'สร้างแบบแล้ว');
      if (!currentId) {
        createdIdRef.current = String(saved.id);
        onReplace(`/offices/${siteId}/drawings/${saved.id}`);
      }
      return;
    }
    if (r.status === 0) {
      setIssue(currentId
        ? { kind: 'unknown', snapshot, expected }
        : { kind: 'error', message: `${r.message} — ไม่ทราบว่าสร้างแบบแล้วหรือยัง ระบบไม่ส่งซ้ำอัตโนมัติ กรุณาตรวจรายการแบบของสำนักงาน (เปิดในแท็บใหม่) ก่อนกดบันทึกอีกครั้ง`, listLink: true });
      return;
    }
    // 409 can be our own save: the browser may resend a PUT whose connection
    // dropped after the server stored it. Same content at expected+1 = ours.
    if (r.status === 409) { await settle(snapshot, expected, { currentVersion: r.currentVersion, updatedAt: r.updatedAt }); return; }
    if (r.status === 401) return; // App ended the session; the banner below explains.
    const index = objectIndexFromPath(r.field);
    if (index !== null && snapshot.doc.objects[index]) setFocusId(snapshot.doc.objects[index].id);
    setIssue({ kind: 'error', message: r.message });
  };

  // Did a save of `snapshot` (sent with `expected`) land? Compares what the
  // server holds; used after a timeout and on a 409.
  const savedAs = (snapshot) => ({ meta: { ...snapshot.meta, name: String(snapshot.meta.name).trim(), building_label: snapshot.meta.building_label?.trim() || null, floor_label: snapshot.meta.floor_label?.trim() || null }, doc: snapshot.doc });
  const settle = async (snapshot, expected, conflict = null) => {
    const r = await request(urls.drawing(currentId), { token });
    if (!r.ok) {
      if (conflict) setIssue({ kind: 'conflict', ...conflict });
      else toast.error(r.message);
      return;
    }
    const server = r.data;
    if (server.version === expected + 1 && sameJson(entryFromDrawing(server), savedAs(snapshot))) {
      setSession(s => ({ ...s, server, baseline: acceptSaved(snapshot, server.version) }));
      setIssue(null);
      if (user) clearRecovery({ userId: user.id, drawingKey });
      setLinksNonce(n => n + 1);
      toast.success(`บันทึกแล้ว (ฉบับที่ ${server.version})`);
    } else if (server.version === expected) {
      setIssue({ kind: 'error', message: 'ตรวจแล้ว: การบันทึกครั้งก่อนไม่สำเร็จ งานยังอยู่ครบ กดบันทึกอีกครั้งได้' });
    } else {
      setIssue({ kind: 'conflict', currentVersion: server.version, updatedAt: server.updated_at });
    }
  };
  const verify = () => settle(issue.snapshot, issue.expected);

  const reloadLatest = () => {
    setConfirm(null);
    setIssue(null);
    setSession(null);
    drawingRes.retry();
  };

  const runDelete = async () => {
    const r = await deleteDrawing(currentId, session.baseline.version, token);
    setConfirm(null);
    if (r.ok) {
      if (user) clearRecovery({ userId: user.id, drawingKey });
      clearNavigationGuard();
      toast.success('ลบแบบแล้ว');
      onGo(listPath);
    } else toast.error(r.status === 409 ? 'มีผู้อื่นบันทึกแบบนี้หลังจากที่คุณเปิด จึงยังไม่ลบ กรุณาโหลดฉบับล่าสุดก่อน' : r.message, { duration: 8000 });
  };

  // ---- links ----
  const linkMap = new Map((links || []).map(l => [l.object_id, l]));
  const linkFor = (o) => {
    if (!o?.asset_ref) return null;
    const l = linkMap.get(o.id);
    if (l && l.kind === o.asset_ref.kind && l.id === o.asset_ref.id) return l;
    const a = picked.get(`${o.asset_ref.kind}:${o.asset_ref.id}`);
    return a ? { state: 'new', asset: a } : null;
  };
  const linkStates = new Map();
  if (entry) for (const o of entry.doc.objects) { const l = o.asset_ref && linkFor(o); if (l) linkStates.set(o.id, l.state); }

  // ---- render ----
  if (isNewRoute && !session) {
    if (!token) {
      return (
        <div className="list-page od-page">
          <PageError title="ต้องเข้าสู่ระบบก่อนสร้างแบบ" error={{ message: 'สร้างและแก้ไขแบบได้เฉพาะผู้ดูแลระบบ เครือข่าย และคอมพิวเตอร์' }} />
          <div className="od-inline-actions">
            <button type="button" className="list-button" onClick={() => onGo(listPath)}><ArrowLeft size={18} aria-hidden="true" /> กลับรายการแบบ</button>
            <button type="button" className="list-button list-button-primary" onClick={() => onRequireLogin(window.location.pathname)}><LogIn size={18} aria-hidden="true" /> เข้าสู่ระบบ</button>
          </div>
        </div>
      );
    }
    if (capsRes.data && (!roleOk || !capsRes.data.permissions?.can_create)) {
      return <div className="list-page od-page"><PageError title="บัญชีนี้สร้างแบบไม่ได้" error={{ message: 'สร้างและแก้ไขแบบได้เฉพาะ super_admin, network_admin และ computer_admin' }} /><button type="button" className="list-button" onClick={() => onGo(listPath)}><ArrowLeft size={18} aria-hidden="true" /> กลับรายการแบบ</button></div>;
    }
    const rec = user ? readRecovery({ userId: user.id, drawingKey: `new:${siteId}` }) : null;
    return (
      <div className="list-page od-page">
        {rec && (
          <div className="od-banner" role="status">
            <History size={20} aria-hidden="true" />
            <div><strong>มีแบบใหม่ที่ยังไม่ได้บันทึก</strong><p>“{rec.entry.meta.name}” จากเมื่อ {formatWhen(rec.savedAt)}</p></div>
            <button type="button" className="list-button list-button-primary" onClick={() => setSession({ id: null, history: createHistory(rec.entry), baseline: { entry: null, version: null }, server: null })}>เปิดต่อ</button>
            <button type="button" className="list-button" onClick={() => { clearRecovery({ userId: user.id, drawingKey: `new:${siteId}` }); setRecoveryDismissed(v => !v); }}>ทิ้ง</button>
          </div>
        )}
        <NewDrawingForm siteName={siteName} onCancel={() => onGo(listPath)}
          onStart={(e) => setSession({ id: null, history: createHistory(e), baseline: { entry: null, version: null }, server: null })} />
      </div>
    );
  }

  if (!session) {
    const err = drawingRes.error;
    if (err) {
      return (
        <div className="list-page od-page">
          <PageError title={err.status === 404 ? 'ไม่พบแบบนี้' : 'เปิดแบบไม่สำเร็จ'} error={err} onRetry={err.status === 404 ? null : drawingRes.retry} />
          <button type="button" className="list-button" onClick={() => onGo(listPath)}><ArrowLeft size={18} aria-hidden="true" /> กลับรายการแบบ</button>
        </div>
      );
    }
    return <div className="list-page od-page"><p className="od-state" role="status"><Loader2 size={22} className="animate-spin" aria-hidden="true" /> กำลังเปิดแบบ...</p></div>;
  }

  const server = session.server;
  const status = server ? `บันทึกแล้ว · ฉบับที่ ${session.baseline.version} · ${formatWhen(server.updated_at)}${server.updated_by?.display_name ? ` โดย ${server.updated_by.display_name}` : ''}` : 'ยังไม่ได้บันทึก';
  const readOnlyNote = !schemaOk ? 'แบบนี้ใช้ข้อมูลรุ่นใหม่กว่าที่หน้านี้รองรับ — ดูอย่างเดียว'
    : unknown ? `มีวัตถุ ${unknown} ชิ้นที่หน้านี้ไม่รู้จัก — ดูอย่างเดียวเพื่อไม่บันทึกทับ`
      : !token ? 'ดูอย่างเดียว · เข้าสู่ระบบเพื่อแก้ไข'
        : !roleOk || (perms && !perms.can_edit) ? 'ดูอย่างเดียว (บัญชีนี้ไม่มีสิทธิ์แก้ไขแบบ)' : null;

  const menu = [];
  if (roleOk && token && capsRes.data?.permissions?.can_create && currentId) menu.push({ key: 'duplicate', label: 'ทำสำเนา', run: () => setDup({ entry }) });
  menu.push({ key: 'export', label: 'ดาวน์โหลดไฟล์งาน (JSON)', run: exportDraft });
  if (currentId && roleOk && perms?.can_delete) menu.push({ key: 'delete', label: 'ลบแบบ', danger: true, run: () => setConfirm('delete') });

  const banners = (
    <>
      {!token && dirty && (
        <div className="od-banner od-banner-warn" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>เซสชันสิ้นสุดแล้ว — งานที่ยังไม่บันทึกยังอยู่ในหน้านี้</strong><p>เก็บสำรองไว้ในเครื่องนี้สำหรับบัญชีเดิมแล้ว เข้าสู่ระบบใหม่แล้วกลับมาที่แบบนี้เพื่อบันทึก หรือดาวน์โหลดไฟล์เก็บไว้</p></div>
          <button type="button" className="list-button list-button-primary" onClick={loginAgain}><LogIn size={18} aria-hidden="true" /> เข้าสู่ระบบใหม่</button>
          <button type="button" className="list-button" onClick={exportDraft}><Download size={18} aria-hidden="true" /> ดาวน์โหลดไฟล์งาน</button>
        </div>
      )}
      {!token && !dirty && currentId && (
        <div className="od-banner" role="status">
          <LogIn size={20} aria-hidden="true" />
          <div><p>ดูแบบได้โดยไม่ต้องเข้าสู่ระบบ ผู้ดูแลระบบ เครือข่าย และคอมพิวเตอร์เข้าสู่ระบบเพื่อแก้ไขได้</p></div>
          <button type="button" className="list-button" onClick={() => onRequireLogin(window.location.pathname + window.location.search)}>เข้าสู่ระบบ</button>
        </div>
      )}
      {showRecovery && (
        <div className="od-banner" role="status">
          <History size={20} aria-hidden="true" />
          <div>
            <strong>พบงานที่ยังไม่ได้บันทึกของแบบนี้</strong>
            <p>เก็บไว้เมื่อ {formatWhen(recovery.savedAt)} จากฉบับที่ {recovery.version ?? '—'}{recovery.version !== null && recovery.version !== session.baseline.version ? ` · ตอนนี้แบบเป็นฉบับที่ ${session.baseline.version} แล้ว ถ้ากู้คืนแล้วบันทึก ระบบจะแจ้งว่ามีผู้อื่นแก้ก่อน (เลือกทำสำเนาได้)` : ''}</p>
          </div>
          <button type="button" className="list-button list-button-primary" onClick={() => {
            setSession(s => ({ ...s, history: commit(s.history, recovery.entry), baseline: { ...s.baseline, version: recovery.version ?? s.baseline.version } }));
            setRecoveryDismissed(true);
          }}>กู้คืน</button>
          <button type="button" className="list-button" onClick={() => { clearRecovery({ userId: user.id, drawingKey }); setRecoveryDismissed(true); }}>ทิ้ง</button>
        </div>
      )}
      {issue && issue.kind !== 'conflict' && issue.kind !== 'unknown' && (
        <div className="od-banner od-banner-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>ยังไม่ได้บันทึก</strong><p>{issue.message}</p>{issue.listLink && <a href={listPath} target="_blank" rel="noreferrer">เปิดรายการแบบในแท็บใหม่</a>}</div>
          <button type="button" className="list-button" onClick={() => setIssue(null)}>ปิด</button>
        </div>
      )}
      {issue?.kind === 'unknown' && (
        <div className="od-banner od-banner-warn" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div><strong>ไม่ทราบว่าบันทึกสำเร็จหรือไม่</strong><p>การเชื่อมต่อขาดระหว่างบันทึก ระบบไม่ส่งซ้ำอัตโนมัติ ตรวจกับเซิร์ฟเวอร์ก่อนบันทึกอีกครั้ง งานในหน้านี้ยังอยู่ครบ</p></div>
          <button type="button" className="list-button list-button-primary" onClick={verify}><RefreshCw size={16} aria-hidden="true" /> ตรวจกับเซิร์ฟเวอร์</button>
        </div>
      )}
      {issue?.kind === 'conflict' && (
        <div className="od-banner od-banner-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>มีผู้อื่นบันทึกแบบนี้ไปก่อนแล้ว</strong>
            <p>ตอนนี้เป็นฉบับที่ {issue.currentVersion ?? '—'}{issue.updatedAt ? ` (${formatWhen(issue.updatedAt)})` : ''} ระบบไม่บันทึกทับ งานของคุณยังอยู่ในหน้านี้ — ทำสำเนาเป็นแบบใหม่ ดาวน์โหลดเก็บไว้ หรือโหลดฉบับล่าสุด (ทิ้งการแก้ของคุณ)</p>
          </div>
          {roleOk && capsRes.data?.permissions?.can_create && <button type="button" className="list-button list-button-primary" onClick={() => setDup({ entry })}>บันทึกเป็นสำเนา</button>}
          <button type="button" className="list-button" onClick={exportDraft}><Download size={16} aria-hidden="true" /> ดาวน์โหลด</button>
          <button type="button" className="list-button" onClick={() => setConfirm('reload')}>โหลดฉบับล่าสุด</button>
        </div>
      )}
    </>
  );

  return (
    <div className="od-page od-page-editor">
      <DrawingEditor
        entry={entry} onCommit={onCommit}
        canUndo={canUndo(session.history)} canRedo={canRedo(session.history)}
        onUndo={() => setHistory(undo)} onRedo={() => setHistory(redo)}
        readOnly={!canEdit} readOnlyNote={readOnlyNote} status={status} saving={saving} dirty={dirty} onSave={save}
        caps={caps} siteId={siteId} siteName={siteName} token={token}
        linkFor={linkFor} linkStates={linkStates} linksError={linksRes.error?.message || ''} onRetryLinks={linksRes.retry}
        canLink={canEdit} onAssetPicked={(a) => setPicked(m => new Map(m).set(`${a.kind}:${a.id}`, a))}
        onBackToList={() => onGo(listPath)} menu={menu} banners={banners} focusObjectId={focusId} />

      <ConfirmDialog open={confirm === 'reload'} tone="danger" title="โหลดฉบับล่าสุด?"
        message="การแก้ไขที่ยังไม่บันทึกในหน้านี้จะหายไป ดาวน์โหลดไฟล์งานเก็บไว้ก่อนได้จากปุ่ม “ดาวน์โหลด”"
        confirmLabel="ทิ้งการแก้ไขและโหลดใหม่" onCancel={() => setConfirm(null)} onConfirm={reloadLatest} />
      <ConfirmDialog open={confirm === 'delete'} tone="danger" title="ลบแบบนี้?"
        message={`“${entry.meta.name}” จะถูกลบออกจากรายการ (ไม่กระทบข้อมูลสำนักงานหรือทะเบียนอุปกรณ์)${dirty ? ' การแก้ไขที่ยังไม่บันทึกจะหายไปด้วย' : ''}`}
        confirmLabel="ลบแบบ" onCancel={() => setConfirm(null)} onConfirm={runDelete} />
      {dup && (
        <DuplicateDrawingDialog siteId={siteId} siteName={siteName} entry={dup.entry} links={links} linksError={linksRes.error?.message || ''} onRetryLinks={linksRes.retry}
          token={token} onClose={() => setDup(null)}
          onCreated={(created) => {
            setDup(null);
            toast.success('สร้างสำเนาแล้ว เปิดสำเนาให้แล้ว');
            if (issue?.kind === 'conflict' && user) clearRecovery({ userId: user.id, drawingKey });
            clearNavigationGuard();
            onGo(`/offices/${created.pea_site_id}/drawings/${created.id}`);
          }} />
      )}
    </div>
  );
}

