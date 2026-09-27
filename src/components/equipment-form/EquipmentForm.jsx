import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw, Save } from 'lucide-react';
import SearchableDropdown from '../SearchableDropdown';
import ConfirmDialog from './ConfirmDialog.jsx';
import EquipmentMediaSection from './EquipmentMediaSection.jsx';
import SiteNetworkSection from './SiteNetworkSection.jsx';
import useEquipmentEditor from './useEquipmentEditor.js';
import useSiteNetwork from './useSiteNetwork.js';
import { SECTIONS, WRITABLE_FIELDS, canEditEquipment, isDirty, statusOptionsFor } from './equipmentFields.js';
import { normalizeMac, validateDraft } from './equipmentValidation.js';
import '../ListPage.css';
import '../SearchableDropdown.css';
import './EquipmentForm.css';

const API = import.meta.env.VITE_API_BASE_URL;
const fieldId = (name) => `ef-${name}`;
const siteLabel = (s) => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;

const LOAN_HINT = {
  checking: 'กำลังตรวจสอบรายการยืม — แก้ไขสถานะได้เมื่อตรวจเสร็จ',
  open: 'แก้ไขสถานะไม่ได้ขณะที่อุปกรณ์ถูกยืมอยู่ กรุณาคืนอุปกรณ์ก่อน',
  error: 'ตรวจสอบรายการยืมไม่สำเร็จ จึงล็อกสถานะไว้ก่อน'
};

function useSiteOptions(enabled, token) {
  const [state, setState] = useState({ status: 'loading', sites: [], error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetch(`${API}/api/pea-jobs/sites`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => null);
        const list = Array.isArray(body) ? body : body?.data;
        if (!res.ok || !Array.isArray(list)) throw new Error(`โหลดรายชื่อสำนักงานไม่สำเร็จ (HTTP ${res.status})`);
        setState({ status: 'ready', sites: list.filter(s => s && s.id != null).map(s => ({ ...s, id: String(s.id) })), error: '' });
      })
      .catch(err => { if (!controller.signal.aborted) setState({ status: 'error', sites: [], error: err.message }); });
    return () => controller.abort();
  }, [enabled, token, retry]);
  return { ...state, retry: () => { setState(s => ({ ...s, status: 'loading' })); setRetry(n => n + 1); } };
}

// One form for every add/edit entry point. context.sitePolicy "locked" pins
// the office (office page); "selectable" lets the user pick it (plain form).
export default function EquipmentForm({ ref, equipmentId, context, user, token, onCreated, onSaved, onCancel, heading }) {
  const locked = context.sitePolicy === 'locked';
  const editor = useEquipmentEditor({ equipmentId, context, token });
  const { draft, baseline, load, loan, media, mode, currentId, saving } = editor;
  const siteOptions = useSiteOptions(!locked, token);
  const siteId = locked ? String(context.siteId ?? '') : draft.pea_site_id;
  const network = useSiteNetwork(siteId, { known: locked ? context.network : null, token });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [siteText, setSiteText] = useState(null);
  const formRef = useRef(null);
  const dirty = load.state === 'ready' && isDirty(draft, baseline);

  const siteMismatch = locked && mode === 'edit' && load.state === 'ready' && editor.recordSiteId && editor.recordSiteId !== String(context.siteId);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const labelToSite = useMemo(() => {
    const counts = {};
    siteOptions.sites.forEach(s => { counts[siteLabel(s)] = (counts[siteLabel(s)] || 0) + 1; });
    return new Map(siteOptions.sites.map(s => [counts[siteLabel(s)] > 1 ? `${siteLabel(s)} #${s.id}` : siteLabel(s), s]));
  }, [siteOptions.sites]);
  const selectedSiteLabel = [...labelToSite.entries()].find(([, s]) => s.id === draft.pea_site_id)?.[0] || '';
  const siteInput = siteText ?? selectedSiteLabel;

  const change = (name, value) => {
    editor.setField(name, value);
    if (errors[name]) setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
  };

  const statusLocked = mode === 'edit' && !['clear', 'none'].includes(loan.state);

  const submit = async (event) => {
    event?.preventDefault();
    setBanner(null);
    if (siteMismatch) return;
    // Enter can submit without the MAC field losing focus; normalize here too (visibly).
    const mac = normalizeMac(draft.mac_address);
    const toSave = mac === draft.mac_address ? draft : { ...draft, mac_address: mac };
    if (toSave !== draft) editor.setField('mac_address', mac);
    const found = validateDraft({ ...toSave, pea_site_id: siteId }, { requireSite: true });
    if (!locked && siteText !== null && siteText !== selectedSiteLabel) found.pea_site_id = 'กรุณาเลือกสำนักงานจากรายการ';
    setErrors(found);
    const first = [...WRITABLE_FIELDS].find(name => found[name]);
    if (first) {
      formRef.current?.querySelector(`#${fieldId(first)}`)?.focus();
      setBanner({ tone: 'error', text: `กรุณาแก้ไขข้อมูล ${Object.keys(found).length} ช่องที่ระบุไว้` });
      return;
    }
    if (mode === 'edit' && loan.state === 'checking') { setBanner({ tone: 'error', text: 'กำลังตรวจสอบรายการยืม กรุณารอสักครู่แล้วบันทึกอีกครั้ง' }); return; }
    if (mediaBusy && !event?.force) { setConfirm('upload'); return; }
    const result = await editor.save({ lockedSiteId: locked ? String(context.siteId) : undefined, draft: toSave });
    if (result.kind === 'busy') return;
    if (result.kind === 'created') {
      toast.success(result.message);
      setSiteText(null);
      setBanner({ tone: 'success', text: 'สร้างอุปกรณ์แล้ว — เพิ่มรูปอุปกรณ์หรือรูปสถานที่ต่อได้ด้านล่าง หรือกดกลับรายการ' });
      onCreated?.(result.id);
    } else if (result.kind === 'saved') {
      toast.success(result.message);
      onSaved?.(result.id);
    } else if (result.kind === 'created-no-id') {
      toast.success(result.message, { duration: 8000 });
      onSaved?.(null);
    } else {
      setBanner({ tone: 'error', text: result.message });
    }
  };

  const cancel = () => (dirty ? setConfirm('discard') : onCancel());
  useImperativeHandle(ref, () => ({ requestCancel: cancel }));

  if (load.state === 'loading') {
    return <div className="list-page ef-state" role="status"><Loader2 size={32} className="animate-spin" aria-hidden="true" /> กำลังโหลดข้อมูลอุปกรณ์...</div>;
  }
  if (load.state === 'error' || load.state === 'notfound') {
    return (
      <div className="list-page"><div className="list-error" role="alert"><AlertTriangle size={24} aria-hidden="true" />
        <div><strong>{load.state === 'notfound' ? 'ไม่พบอุปกรณ์' : 'โหลดข้อมูลไม่สำเร็จ'}</strong><p>{load.error}</p></div>
        {load.state === 'error' && <button type="button" className="list-button" onClick={editor.reload}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button>}
        <button type="button" className="list-button" onClick={onCancel}>กลับ</button>
      </div></div>
    );
  }

  const renderField = (field) => {
    const value = draft[field.name] ?? '';
    const error = errors[field.name];
    const disabled = field.name === 'status' && statusLocked;
    const hintId = `${fieldId(field.name)}-hint`;
    const hint = disabled ? LOAN_HINT[loan.state] : field.hint;
    const describedBy = [error && `${fieldId(field.name)}-error`, hint && hintId].filter(Boolean).join(' ') || undefined;
    const common = { id: fieldId(field.name), name: field.name, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, disabled };
    return (
      <div key={field.name} className={`list-field ef-field ef-field-${field.type}${value.trim() ? ' is-active' : ''}${error ? ' is-invalid' : ''}${field.type === 'textarea' ? ' ef-wide' : ''}`}>
        <label htmlFor={fieldId(field.name)}>{field.label}{field.required && <span className="ef-required" aria-hidden="true"> *</span>}{field.required && <span className="list-sr-only"> (จำเป็น)</span>}</label>
        {field.type === 'combo' ? (
          <SearchableDropdown inputId={fieldId(field.name)} label={field.label} value={value} disabled={disabled} describedBy={describedBy}
            options={field.name === 'status' ? statusOptionsFor(baseline.status) : field.options}
            placeholder="เลือกจากรายการ หรือพิมพ์เอง" onChange={v => change(field.name, v)} />
        ) : field.type === 'textarea' ? (
          <textarea {...common} rows={4} value={value} placeholder={field.placeholder} onChange={e => change(field.name, e.target.value)} />
        ) : (
          <input {...common} type={field.type} value={value} placeholder={field.placeholder} inputMode={field.inputMode} required={field.required}
            className={field.mono ? 'ef-mono' : undefined} autoComplete="off"
            onChange={e => change(field.name, e.target.value)}
            onBlur={field.name === 'mac_address' ? e => { const n = normalizeMac(e.target.value); if (n !== e.target.value) change('mac_address', n); } : undefined} />
        )}
        {hint && <p id={hintId} className={disabled ? 'ef-hint ef-hint-warn' : 'ef-hint'}>{hint}{disabled && loan.state === 'error' && <> <button type="button" className="ef-link" onClick={editor.recheckLoan}>ตรวจอีกครั้ง</button></>}</p>}
        {error && <p id={`${fieldId(field.name)}-error`} className="ef-error">{error}</p>}
      </div>
    );
  };

  const lockedSite = context.site;
  return (
    <form ref={formRef} className="list-page ef-form" onSubmit={submit} noValidate aria-labelledby="ef-heading">
      <div className="ef-head">
        <h2 id="ef-heading">{heading || (mode === 'create' ? 'เพิ่มอุปกรณ์' : 'แก้ไขข้อมูลอุปกรณ์')}</h2>
        <p className="list-muted">ช่องที่มี * จำเป็นต้องกรอก · ช่องที่มีข้อมูลจะถูกไฮไลท์ (ยังไม่ได้บันทึกจนกว่าจะกด “บันทึก”)</p>
      </div>

      {siteMismatch && (
        <div className="list-error" role="alert"><AlertTriangle size={24} aria-hidden="true" /><div><strong>อุปกรณ์นี้อยู่ในสำนักงานอื่น</strong><p>ข้อมูลที่โหลดมาไม่ตรงกับสำนักงานที่เปิดอยู่ จึงไม่อนุญาตให้บันทึกจากหน้านี้เพื่อไม่ให้ย้ายสำนักงานโดยไม่ตั้งใจ</p></div></div>
      )}
      {banner && (
        <div className={banner.tone === 'success' ? 'ef-banner-success' : 'list-error'} role={banner.tone === 'success' ? 'status' : 'alert'}>
          {banner.tone === 'success' ? <CheckCircle2 size={22} aria-hidden="true" /> : <AlertTriangle size={22} aria-hidden="true" />}<div><p>{banner.text}</p></div>
        </div>
      )}

      <div className="ef-grid">
        {SECTIONS.map(section => (
          <section key={section.id} className={`ef-section ef-section-${section.id}`} aria-labelledby={`ef-sec-${section.id}`}>
            <h3 id={`ef-sec-${section.id}`}>{section.title}</h3>
            <div className="ef-fields">
              {section.fields.map(renderField)}
              {section.id === 'general' && (locked ? (
                <div className="ef-field ef-locked-site ef-wide">
                  <span className="ef-label">สำนักงาน</span>
                  <p><Lock size={16} aria-hidden="true" /> <strong>{lockedSite ? siteLabel(lockedSite) : `สำนักงาน #${context.siteId}`}</strong></p>
                  <p className="ef-hint">{mode === 'create' ? 'เพิ่มอุปกรณ์ให้สำนักงานนี้' : 'อุปกรณ์ของสำนักงานนี้'} — เปลี่ยนสำนักงานได้จากหน้าแก้ไขอุปกรณ์ปกติ</p>
                </div>
              ) : (
                <div className={`list-field ef-field ef-wide${draft.pea_site_id ? ' is-active' : ''}${errors.pea_site_id ? ' is-invalid' : ''}`}>
                  <label htmlFor={fieldId('pea_site_id')}>สำนักงาน<span className="ef-required" aria-hidden="true"> *</span><span className="list-sr-only"> (จำเป็น)</span></label>
                  {siteOptions.status === 'error' ? (
                    <p className="ef-error" role="alert">{siteOptions.error} <button type="button" className="ef-link" onClick={siteOptions.retry}>ลองใหม่</button></p>
                  ) : (
                    <SearchableDropdown inputId={fieldId('pea_site_id')} label="สำนักงาน" value={siteInput}
                      disabled={siteOptions.status === 'loading'} describedBy={errors.pea_site_id ? `${fieldId('pea_site_id')}-error` : undefined}
                      placeholder={siteOptions.status === 'loading' ? 'กำลังโหลดรายชื่อสำนักงาน...' : 'พิมพ์ชื่อสำนักงานหรือจังหวัด แล้วเลือกจากรายการ'}
                      options={[...labelToSite.keys()]}
                      onChange={text => {
                        setSiteText(text);
                        const match = labelToSite.get(text);
                        if (match) { change('pea_site_id', match.id); setSiteText(null); }
                      }} />
                  )}
                  {siteText !== null && siteText !== selectedSiteLabel && !errors.pea_site_id && <p className="ef-hint ef-hint-warn">ยังไม่ได้เลือกสำนักงาน — เลือกจากรายการเท่านั้น{draft.pea_site_id ? ` (ค่าที่ใช้อยู่: ${selectedSiteLabel})` : ''}</p>}
                  {errors.pea_site_id && <p id={`${fieldId('pea_site_id')}-error`} className="ef-error">{errors.pea_site_id}</p>}
                </div>
              ))}
              {section.id === 'network' && (
                <div className="ef-wide"><SiteNetworkSection siteId={siteId} network={network} equipmentType={draft.equipment_type} department={draft.department} /></div>
              )}
              {section.id === 'place' && (
                <div className="ef-wide"><EquipmentMediaSection equipmentId={currentId} media={media} token={token} onChanged={editor.refreshMedia} onBusyChange={setMediaBusy} /></div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="ef-actions">
        <span className="list-muted">{dirty ? 'มีการแก้ไขที่ยังไม่ได้บันทึก' : mode === 'edit' ? 'ข้อมูลตรงกับที่บันทึกไว้' : ''}</span>
        <div>
          <button type="button" className="list-button" onClick={cancel} disabled={saving}>{mode === 'edit' && !dirty ? 'กลับรายการ' : 'ยกเลิก'}</button>
          <button type="submit" className="list-button list-button-primary" disabled={saving || siteMismatch || !canEditEquipment(user)}>
            {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {saving ? 'กำลังบันทึก...' : mode === 'create' ? 'สร้างอุปกรณ์' : 'บันทึก'}
          </button>
        </div>
      </div>

      <ConfirmDialog open={confirm === 'discard'} title="ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?" tone="danger" confirmLabel="ทิ้งการแก้ไข" cancelLabel="แก้ไขต่อ"
        message="ข้อมูลที่แก้ไขแต่ยังไม่ได้กดบันทึกจะหายไป (รูปที่อัปโหลดแล้วยังอยู่ เพราะบันทึกทันทีตอนอัปโหลด)"
        onConfirm={() => { setConfirm(null); onCancel(); }} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'upload'} title="รูปยังอัปโหลดไม่เสร็จ" tone="warning" confirmLabel="บันทึกข้อมูลเลย" cancelLabel="รอ"
        message="ข้อมูลข้อความกับรูปเป็นคนละคำขอ บันทึกข้อมูลตอนนี้ได้ ส่วนรูปที่กำลังอัปโหลดจะแจ้งผลแยกเมื่อเสร็จ"
        onConfirm={() => { setConfirm(null); submit({ preventDefault() {}, force: true }); }} onCancel={() => setConfirm(null)} />
    </form>
  );
}
