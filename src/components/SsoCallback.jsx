import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import './Auth.css';

// Landing page for the PEA SSO redirect. The backend sends the browser back
// here with #token=xxx&user=<url-encoded JSON> in the URL fragment (never in
// the query string or path, so it never gets logged server-side). This page
// extracts that pair and hands it to the same onAuthSuccess used by the
// username/password login, so both flows end up in identical state.
//
// The fragment is wiped from the address bar straight away (success or not)
// so the token can't linger in history, and it is read only once: a retry is
// always the user's own click back into SSO, never an automatic loop.
const SsoCallback = ({ onAuthSuccess, onBackToLogin }) => {
  const [error, setError] = useState(null);
  const handled = useRef(false);
  const onAuthSuccessRef = useRef(onAuthSuccess);
  useEffect(() => { onAuthSuccessRef.current = onAuthSuccess; });

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    if (hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);

    const token = params.get('token');
    const userRaw = params.get('user');
    if (params.get('error')) { setError('PEA SSO ปฏิเสธการเข้าสู่ระบบหรือยกเลิกกลางทาง'); return; }
    if (!token || !userRaw) { setError('ไม่พบข้อมูลการเข้าสู่ระบบจาก PEA SSO ลิงก์นี้อาจถูกใช้ไปแล้วหรือเปิดโดยตรง'); return; }
    try {
      const userData = JSON.parse(userRaw);
      if (!userData || typeof userData !== 'object') throw new Error('bad user');
      onAuthSuccessRef.current(userData, token, 'sso');
    } catch {
      setError('ข้อมูลผู้ใช้ที่ได้รับจาก PEA SSO ไม่ถูกต้อง');
    }
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        {error ? (
          <div className="auth-state" role="alert">
            <AlertTriangle size={40} aria-hidden="true" color="var(--accent-danger)" />
            <h1 className="auth-state-title">เข้าสู่ระบบด้วย PEA SSO ไม่สำเร็จ</h1>
            <p>{error}</p>
            <a href={`${import.meta.env.VITE_API_BASE_URL}/api/auth/sso/login`} className="auth-primary">
              <ShieldCheck size={20} aria-hidden="true" /> ลองเข้าสู่ระบบด้วย PEA SSO อีกครั้ง
            </a>
            <button type="button" className="auth-secondary" onClick={onBackToLogin}>กลับไปหน้าเข้าสู่ระบบ</button>
          </div>
        ) : (
          <div className="auth-state" role="status">
            <Loader2 className="animate-spin" size={40} aria-hidden="true" color="var(--accent-primary)" />
            <p>กำลังเข้าสู่ระบบผ่าน PEA SSO…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SsoCallback;
