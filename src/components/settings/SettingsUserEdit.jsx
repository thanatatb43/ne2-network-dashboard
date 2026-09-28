import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowLeft, Key, Loader2, RefreshCw, Save } from 'lucide-react';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import { setNavigationGuard, clearNavigationGuard } from '../../navigationGuard';
import { API, ROLES, roleLabel, settingsPermissions, fullName, failureMessage, loadUsers, PASSWORD_RULE } from './settingsShared';
import '../ListPage.css';
import '../AdminSettings.css';

const FIELDS = ['first_name', 'last_name', 'role', 'pea_branch', 'pea_division'];
const pick = (u) => Object.fromEntries(FIELDS.map((k) => [k, u?.[k] ?? '']));

// Edit one user on its own page (/settings/users/:id) so browser Back leaves
// the form like any other page -- asking first while it has unsaved edits.
export default function SettingsUserEdit({ token, currentUser, userId, onDone }) {
  const id = useId();
  const perms = settingsPermissions(currentUser);
  const [load, setLoad] = useState({ status: 'loading', error: '' });
  const [target, setTarget] = useState(null);
  const [data, setData] = useState(pick(null));
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'role' | 'discard'
  const [retry, setRetry] = useState(0);
  const formRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoad({ status: 'loading', error: '' });
    loadUsers(token, controller.signal)
      .then((users) => {
        if (!active) return;
        const found = users.find((u) => String(u.id) === String(userId));
        if (!found) { setLoad({ status: 'missing', error: '' }); return; }
        setTarget(found);
        setData(pick(found));
        setLoad({ status: 'ready', error: '' });
      })
      .catch((err) => { if (active) setLoad({ status: 'error', error: err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [token, userId, retry]);

  const initial = pick(target);
  const changed = FIELDS.filter((k) => String(initial[k]) !== String(data[k]));
  const dirty = Boolean(target) && (changed.length > 0 || (changePassword && Boolean(password.password || password.confirm)));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    const release = setNavigationGuard(() => true);
    return () => { window.removeEventListener('beforeunload', warn); release(); };
  }, [dirty]);

  const leave = () => { clearNavigationGuard(); onDone(); };
  const requestLeave = () => (dirty ? setConfirm('discard') : onDone());

  const set = (k, v) => {
    setData((d) => ({ ...d, [k]: v }));
    setNotice('');
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!String(data.first_name).trim()) e.first_name = 'กรุณาระบุชื่อ';
    if (changePassword) {
      if (!PASSWORD_RULE.test(password.password)) e.password = 'ต้องยาวอย่างน้อย 10 ตัวอักษร มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และอักขระพิเศษ';
      if (password.confirm !== password.password) e.confirm = 'รหัสผ่านยืนยันไม่ตรงกัน';
    }
    return e;
  };

  const save = async () => {
    setConfirm(null);
    setBusy(true);
    setSubmitError('');
    const payload = { ...Object.fromEntries(FIELDS.map((k) => [k, typeof data[k] === 'string' ? data[k].trim() : data[k]])), ...(changePassword ? { password: password.password } : {}) };
    try {
      const response = await fetch(`${API}/api/auth/users/${target.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) { setSubmitError(failureMessage(response, result, 'บันทึกไม่สำเร็จ')); return; }
      toast.success(`บันทึกข้อมูล @${target.username} แล้ว`);
      leave();
    } catch {
      setSubmitError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ข้อมูลที่แก้ไขยังอยู่ในฟอร์มนี้');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      formRef.current?.querySelector(`#${CSS.escape(`${id}-${Object.keys(found)[0]}`)}`)?.focus();
      return;
    }
    if (!changed.length && !changePassword) { setNotice('ยังไม่มีข้อมูลที่เปลี่ยน'); return; }
    // A role change alters what the person can do -- confirm it by name.
    if (changed.includes('role')) { setConfirm('role'); return; }
    save();
  };

  if (load.status !== 'ready') {
    return (
      <div className="list-page as-page">
        <button type="button" className="list-button as-back" onClick={onDone}><ArrowLeft size={16} aria-hidden="true" /> กลับไปรายชื่อผู้ใช้</button>
        <div className="as-state" role={load.status === 'error' ? 'alert' : 'status'}>
          {load.status === 'loading' ? <><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>กำลังโหลดข้อมูลผู้ใช้…</p></>
            : load.status === 'missing' ? <><AlertCircle size={24} aria-hidden="true" /><p><strong>ไม่พบผู้ใช้นี้</strong><br />บัญชีอาจถูกลบไปแล้ว</p></>
              : <><AlertCircle size={24} aria-hidden="true" /><p><strong>โหลดข้อมูลผู้ใช้ไม่สำเร็จ</strong><br />{load.error}</p><button type="button" className="list-button" onClick={() => setRetry((n) => n + 1)}><RefreshCw size={16} aria-hidden="true" /> ลองใหม่</button></>}
        </div>
      </div>
    );
  }

  const locked = !perms.canEditUsers || target.role === 'super_admin';
  const roleInfo = ROLES.find((r) => r.value === data.role);

  return (
    <div className="list-page as-page">
      <button type="button" className="list-button as-back" onClick={requestLeave}><ArrowLeft size={16} aria-hidden="true" /> กลับไปรายชื่อผู้ใช้</button>
      <header className="list-header">
        <div>
          <h1>แก้ไขผู้ใช้</h1>
          <p>{fullName(target)} · @{target.username} · สิทธิ์ปัจจุบัน {roleLabel(target.role)}</p>
        </div>
      </header>

      {locked ? (
        <div className="list-error as-locked" role="status">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{!perms.canEditUsers ? 'บัญชีนี้ดูข้อมูลผู้ใช้ได้อย่างเดียว' : 'บัญชีผู้ดูแลระบบสูงสุดแก้ไขจากหน้านี้ไม่ได้'}</strong></div>
        </div>
      ) : (
        <form ref={formRef} className="as-form" onSubmit={submit} noValidate>
          {submitError && <div className="list-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><div><strong>บันทึกไม่สำเร็จ</strong><p>{submitError}</p></div></div>}

          <section className="as-panel" aria-labelledby={`${id}-profile`}>
            <h2 id={`${id}-profile`}>ข้อมูลผู้ใช้</h2>
            <div className="as-form-grid">
              {[['first_name', 'ชื่อ', true], ['last_name', 'นามสกุล'], ['pea_branch', 'สังกัด (การไฟฟ้า)'], ['pea_division', 'แผนก']].map(([k, label, required]) => (
                <div key={k} className={`as-field${errors[k] ? ' is-invalid' : ''}`}>
                  <label htmlFor={`${id}-${k}`}>{label}{required && <span className="as-required" aria-hidden="true"> *</span>}</label>
                  <input
                    id={`${id}-${k}`} type="text" value={data[k]} required={required}
                    autoComplete="off"
                    aria-invalid={errors[k] ? 'true' : undefined}
                    aria-describedby={errors[k] ? `${id}-${k}-error` : undefined}
                    onChange={(e) => set(k, e.target.value)}
                  />
                  {errors[k] && <p id={`${id}-${k}-error`} className="as-field-error">{errors[k]}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="as-panel" aria-labelledby={`${id}-access`}>
            <h2 id={`${id}-access`}>สิทธิ์การใช้งาน</h2>
            <div className="as-field">
              <label htmlFor={`${id}-role`}>สิทธิ์</label>
              <select id={`${id}-role`} value={data.role} onChange={(e) => set('role', e.target.value)} aria-describedby={`${id}-role-desc`}>
                {!ROLES.some((r) => r.value === data.role) && <option value={data.role}>{data.role || 'ไม่ระบุ'}</option>}
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p id={`${id}-role-desc`} className="as-help">{roleInfo?.desc || 'สิทธิ์นี้ไม่มีคำอธิบาย'}{changed.includes('role') ? ` · เปลี่ยนจาก "${roleLabel(target.role)}"` : ''}</p>
            </div>
          </section>

          <section className="as-panel" aria-labelledby={`${id}-password-title`}>
            <h2 id={`${id}-password-title`}><Key size={18} aria-hidden="true" /> รหัสผ่าน</h2>
            <label className="as-check">
              <input type="checkbox" checked={changePassword} onChange={(e) => { setChangePassword(e.target.checked); setPassword({ password: '', confirm: '' }); setErrors((er) => { const n = { ...er }; delete n.password; delete n.confirm; return n; }); }} />
              ตั้งรหัสผ่านใหม่ให้ผู้ใช้นี้
            </label>
            {changePassword && (
              <div className="as-form-grid">
                {[['password', 'รหัสผ่านใหม่'], ['confirm', 'ยืนยันรหัสผ่านใหม่']].map(([k, label]) => (
                  <div key={k} className={`as-field${errors[k] ? ' is-invalid' : ''}`}>
                    <label htmlFor={`${id}-${k}`}>{label}<span className="as-required" aria-hidden="true"> *</span></label>
                    <input
                      id={`${id}-${k}`} type="password" autoComplete="new-password" value={password[k]} required
                      aria-invalid={errors[k] ? 'true' : undefined}
                      aria-describedby={`${k === 'password' ? `${id}-pw-rule ` : ''}${errors[k] ? `${id}-${k}-error` : ''}`.trim() || undefined}
                      onChange={(e) => { setPassword((p) => ({ ...p, [k]: e.target.value })); if (errors[k]) setErrors((er) => { const n = { ...er }; delete n[k]; return n; }); }}
                    />
                    {errors[k] && <p id={`${id}-${k}-error`} className="as-field-error">{errors[k]}</p>}
                  </div>
                ))}
                <p id={`${id}-pw-rule`} className="as-help as-wide">อย่างน้อย 10 ตัวอักษร มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และอักขระพิเศษอย่างน้อยอย่างละ 1 ตัว</p>
              </div>
            )}
          </section>

          {notice && <p className="as-notice" role="status">{notice}</p>}
          <div className="as-form-actions">
            <button type="button" className="list-button" onClick={requestLeave} disabled={busy}>ยกเลิก</button>
            <button type="submit" className="list-button list-button-primary" disabled={busy}>
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />} บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirm === 'role'}
        title="เปลี่ยนสิทธิ์ผู้ใช้?"
        tone="warning"
        confirmLabel="เปลี่ยนสิทธิ์และบันทึก"
        cancelLabel="กลับไปแก้ไข"
        message={(
          <>
            <p><strong>{fullName(target)} (@{target.username})</strong> จะเปลี่ยนจาก "{roleLabel(target.role)}" เป็น "{roleLabel(data.role)}"</p>
            <p>{roleInfo?.desc}</p>
            {String(target.id) === String(currentUser?.id) && <p><strong>นี่คือบัญชีของคุณ</strong> สิทธิ์ที่ลดลงอาจทำให้คุณเข้าหน้านี้ไม่ได้อีก</p>}
          </>
        )}
        onConfirm={save}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="ออกโดยไม่บันทึก?"
        message="ข้อมูลที่แก้ไขในหน้านี้ยังไม่ได้บันทึกและจะหายไป"
        confirmLabel="ออกโดยไม่บันทึก" cancelLabel="อยู่ต่อเพื่อบันทึก" tone="danger"
        onConfirm={() => { setConfirm(null); leave(); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
