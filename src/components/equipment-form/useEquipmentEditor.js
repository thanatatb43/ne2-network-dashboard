import { useCallback, useEffect, useRef, useState } from 'react';
import { draftFromRecord, emptyDraft } from './equipmentFields.js';
import { serializeDraft } from './equipmentValidation.js';

const API = import.meta.env.VITE_API_BASE_URL;
const MEDIA_FIELDS = ['photos', 'storage_photo', 'updatedAt'];

const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

const readJson = async (res) => {
  try { return await res.json(); } catch { return null; }
};

const httpMessage = (res, body, fallback) => {
  if (res.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (res.status === 403) return 'คุณไม่มีสิทธิ์ดำเนินการนี้';
  return body?.message || body?.error || fallback;
};

export const fetchEquipmentRecord = async (id, token, signal) => {
  const res = await fetch(`${API}/api/office-equipment/${id}`, { headers: authHeaders(token), signal });
  const body = await readJson(res);
  if (res.status === 404 || (res.ok && body?.success === false)) return { notFound: true };
  if (!res.ok || !body?.data) throw new Error(httpMessage(res, body, 'โหลดข้อมูลอุปกรณ์ไม่สำเร็จ'));
  return { record: body.data };
};

// mode/currentId live here (not in the caller) so switching create -> edit
// after a successful POST keeps the draft and never remounts the form.
export default function useEquipmentEditor({ equipmentId, context, token }) {
  const isNewProp = !equipmentId || equipmentId === 'new';
  const [currentId, setCurrentId] = useState(isNewProp ? null : String(equipmentId));
  const [draft, setDraft] = useState(() => emptyDraft(context));
  const [baseline, setBaseline] = useState(() => emptyDraft(context));
  const [media, setMedia] = useState({ photos: [], storage_photo: null, updatedAt: null });
  const [recordSiteId, setRecordSiteId] = useState(null);
  const [load, setLoad] = useState({ state: isNewProp ? 'ready' : 'loading', error: '' });
  const [loan, setLoan] = useState({ state: isNewProp ? 'none' : 'checking', loan: null });
  const [saving, setSaving] = useState(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);
  const latestDraftRef = useRef(draft);
  const latestBaselineRef = useRef(baseline);
  useEffect(() => { latestDraftRef.current = draft; latestBaselineRef.current = baseline; });

  const checkLoan = useCallback(async (id) => {
    const request = requestRef.current;
    setLoan({ state: 'checking', loan: null });
    try {
      const res = await fetch(`${API}/api/office-equipment/${id}/loans`, { headers: authHeaders(token) });
      const body = await readJson(res);
      const list = Array.isArray(body) ? body : body?.data;
      if (!res.ok || !Array.isArray(list)) throw new Error('bad response');
      if (request !== requestRef.current) return;
      const open = list.find(l => l && !l.returned_at) || null;
      setLoan({ state: open ? 'open' : 'clear', loan: open });
    } catch {
      if (request === requestRef.current) setLoan({ state: 'error', loan: null });
    }
  }, [token]);

  const loadRecord = useCallback(async (id) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoad({ state: 'loading', error: '' });
    try {
      const { record, notFound } = await fetchEquipmentRecord(id, token);
      if (request !== requestRef.current) return;
      if (notFound) { setLoad({ state: 'notfound', error: 'ไม่พบข้อมูลอุปกรณ์นี้' }); return; }
      const next = draftFromRecord(record);
      setDraft(next);
      setBaseline(next);
      setRecordSiteId(record.pea_site_id != null ? String(record.pea_site_id) : '');
      setMedia({ photos: Array.isArray(record.photos) ? record.photos : [], storage_photo: record.storage_photo || null, updatedAt: record.updatedAt || null });
      setLoad({ state: 'ready', error: '' });
      checkLoan(id);
    } catch (err) {
      if (request === requestRef.current) setLoad({ state: 'error', error: err.message || 'โหลดข้อมูลไม่สำเร็จ' });
    }
  }, [token, checkLoan]);

  // The prop catching up to an id this hook already switched to (after a
  // create) must not refetch and overwrite the draft.
  const loadedIdRef = useRef(null);
  useEffect(() => {
    if (isNewProp || String(equipmentId) === loadedIdRef.current) return undefined;
    loadedIdRef.current = String(equipmentId);
    setCurrentId(String(equipmentId));
    loadRecord(String(equipmentId));
    return () => {
      // Unmount or a different id: drop this load's late responses and allow a reload.
      requestRef.current += 1;
      loadedIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  const setField = useCallback((name, value) => setDraft(prev => ({ ...prev, [name]: value })), []);

  // Only media fields: uploads land while other fields may still be unsaved.
  const refreshMedia = useCallback(async () => {
    if (!currentId) return;
    try {
      const { record } = await fetchEquipmentRecord(currentId, token);
      if (record) setMedia(Object.fromEntries(MEDIA_FIELDS.map(k => [k, k === 'photos' ? (Array.isArray(record.photos) ? record.photos : []) : record[k] ?? null])));
    } catch { /* the upload itself already reported its own result */ }
  }, [currentId, token]);

  const save = useCallback(async ({ lockedSiteId, draft: override } = {}) => {
    const draft = override || latestDraftRef.current;
    if (savingRef.current) return { kind: 'busy' };
    savingRef.current = true;
    setSaving(true);
    const creating = !currentId;
    try {
      // Status may not change while the equipment is on loan. Re-checked here
      // because a loan can start after the form was opened.
      const baselineStatus = String(latestBaselineRef.current.status ?? '').trim();
      if (!creating && String(draft.status ?? '').trim() !== baselineStatus) {
        let open = null;
        try {
          const res = await fetch(`${API}/api/office-equipment/${currentId}/loans`, { headers: authHeaders(token) });
          const body = await readJson(res);
          const list = Array.isArray(body) ? body : body?.data;
          if (!res.ok || !Array.isArray(list)) throw new Error('bad response');
          open = list.find(l => l && !l.returned_at) || null;
        } catch {
          setLoan({ state: 'error', loan: null });
          return { kind: 'error', message: 'ตรวจสอบรายการยืมไม่สำเร็จ จึงยังไม่บันทึกการเปลี่ยนสถานะ กรุณาลองใหม่' };
        }
        if (open) {
          setLoan({ state: 'open', loan: open });
          setDraft(prev => ({ ...prev, status: baselineStatus }));
          return { kind: 'error', message: 'อุปกรณ์นี้ถูกยืมอยู่ จึงเปลี่ยนสถานะไม่ได้ ระบบคืนค่าสถานะเดิมแล้ว — กดบันทึกอีกครั้งเพื่อบันทึกช่องอื่น' };
        }
      }
      const res = await fetch(creating ? `${API}/api/office-equipment` : `${API}/api/office-equipment/${currentId}`, {
        method: creating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...authHeaders(token) },
        body: serializeDraft(draft, { siteId: lockedSiteId, baseline: creating ? undefined : latestBaselineRef.current }).toString()
      });
      const body = await readJson(res);
      if (!res.ok || body?.success === false) {
        return { kind: 'error', status: res.status, message: httpMessage(res, body, 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง') };
      }
      const saved = { ...draft, ...(lockedSiteId != null ? { pea_site_id: String(lockedSiteId) } : {}) };
      setBaseline(saved);
      // Keep anything typed while the request was in flight (it stays dirty).
      setDraft(prev => ({ ...prev, pea_site_id: saved.pea_site_id }));
      if (!creating) {
        setRecordSiteId(saved.pea_site_id);
        return { kind: 'saved', id: currentId, message: body?.message || 'บันทึกข้อมูลสำเร็จ' };
      }
      const newId = body?.data?.id ?? body?.id;
      if (newId == null) return { kind: 'created-no-id', message: 'สร้างอุปกรณ์แล้ว แต่ระบบไม่ส่งรหัสอุปกรณ์กลับมา จึงยังเพิ่มรูปต่อไม่ได้' };
      requestRef.current += 1;
      loadedIdRef.current = String(newId);
      setCurrentId(String(newId));
      setRecordSiteId(saved.pea_site_id);
      setMedia({ photos: [], storage_photo: null, updatedAt: body?.data?.updatedAt ?? null });
      setLoad({ state: 'ready', error: '' });
      setLoan({ state: 'clear', loan: null });
      return { kind: 'created', id: String(newId), message: body?.message || 'สร้างอุปกรณ์สำเร็จ' };
    } catch {
      // The request may have reached the server; never claim it failed outright.
      return {
        kind: 'unknown',
        message: creating
          ? 'ไม่ได้รับคำตอบจากเซิร์ฟเวอร์ ไม่ทราบว่าสร้างอุปกรณ์สำเร็จหรือไม่ กรุณาตรวจสอบรายการอุปกรณ์ก่อนกดบันทึกอีกครั้ง'
          : 'ไม่ได้รับคำตอบจากเซิร์ฟเวอร์ ไม่ทราบว่าบันทึกสำเร็จหรือไม่ กรุณาลองบันทึกอีกครั้ง'
      };
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [currentId, token]);

  return {
    currentId, mode: currentId ? 'edit' : 'create', draft, baseline, media, recordSiteId, load, loan, saving,
    setField, setDraft, save, refreshMedia, reload: () => currentId && loadRecord(currentId), recheckLoan: () => currentId && checkLoan(currentId)
  };
}
