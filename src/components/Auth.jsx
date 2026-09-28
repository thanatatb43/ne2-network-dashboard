import { useEffect, useId, useRef, useState } from 'react';
import { User, Lock, ArrowRight, ArrowLeft, Loader2, ShieldCheck, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { APP_NAME, APP_NAME_TH } from '../config/branding';
import { authCodeOf, AUTH_MESSAGES } from '../authSession';
import './Auth.css';

const API = import.meta.env.VITE_API_BASE_URL;

const Auth = ({ onAuthSuccess }) => {
  const id = useId();
  const [screen, setScreen] = useState('sso'); // 'sso' (primary) or 'local' (username/password form)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const usernameRef = useRef(null);
  const localButtonRef = useRef(null);
  const switched = useRef(false);

  // Moving between the two screens keeps keyboard focus on something useful.
  useEffect(() => {
    if (!switched.current) return;
    if (screen === 'local') usernameRef.current?.focus();
    else localButtonRef.current?.focus();
  }, [screen]);
  const switchTo = (next) => { switched.current = true; setError(''); setShowPassword(false); setScreen(next); };

  // A failed attempt never leaves the password on screen or in memory; the
  // username stays so the user can simply try again.
  const forgetPassword = () => {
    setFormData((f) => ({ ...f, password: '' }));
    setShowPassword(false);
    requestAnimationFrame(() => document.getElementById(`${id}-password`)?.focus());
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.username.trim() || !formData.password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      (formData.username.trim() ? document.getElementById(`${id}-password`) : usernameRef.current)?.focus();
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username.trim(), password: formData.password })
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && (result.success || result.token)) {
        // Accept the response shapes the backend has used: nested user,
        // user fields at the root, or a data wrapper.
        const userData = result.user || result.data?.user || (result.username ? result : result.data) || { username: formData.username.trim() };
        const userToken = result.token || result.data?.token || result.access_token || result.data?.access_token;
        if (typeof userData === 'object' && !userData?.username) userData.username = formData.username.trim();
        onAuthSuccess(userData, userToken, 'local', result.session || result.data?.session || null);
        return;
      }
      const code = authCodeOf(result);
      setError(code && AUTH_MESSAGES[code]
        ? AUTH_MESSAGES[code]
        : response.status === 503 ? AUTH_MESSAGES.AUTH_SERVICE_UNAVAILABLE
          : response.status === 401 || response.status === 400 ? (result.message || AUTH_MESSAGES.AUTH_INVALID_CREDENTIALS)
            : `เข้าสู่ระบบไม่สำเร็จ (HTTP ${response.status})`);
      forgetPassword();
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่');
      forgetPassword();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-icon" aria-hidden="true">{screen === 'sso' ? <ShieldCheck size={32} /> : <KeyRound size={32} />}</span>
          <h1>เข้าสู่ระบบ</h1>
          <p>{APP_NAME} · {APP_NAME_TH}</p>
        </div>

        {screen === 'sso' ? (
          <div className="auth-stack">
            {/* Full browser navigation on purpose (not fetch): the backend
                redirects the whole page through the PEA SSO provider and back. */}
            <a href={`${API}/api/auth/sso/login`} className="auth-primary">
              <ShieldCheck size={22} aria-hidden="true" /> เข้าสู่ระบบด้วย PEA SSO
            </a>
            <div className="auth-divider"><span>หรือ</span></div>
            <button ref={localButtonRef} type="button" className="auth-secondary" onClick={() => switchTo('local')}>
              <KeyRound size={18} aria-hidden="true" /> เข้าสู่ระบบด้วยบัญชีของระบบ
            </button>
            <p className="auth-hint">บัญชีของระบบใช้สำหรับผู้ที่ได้รับชื่อผู้ใช้และรหัสผ่านจากผู้ดูแลระบบ</p>
          </div>
        ) : (
          <>
            <form className="auth-stack" onSubmit={handleSubmit} noValidate aria-describedby={error ? `${id}-error` : undefined}>
              <div className="auth-field">
                <label htmlFor={`${id}-username`}>ชื่อผู้ใช้</label>
                <div className="auth-input">
                  <User size={18} aria-hidden="true" />
                  <input
                    ref={usernameRef}
                    id={`${id}-username`}
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={formData.username}
                    onChange={handleChange}
                    aria-invalid={error && !formData.username.trim() ? 'true' : undefined}
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor={`${id}-password`}>รหัสผ่าน</label>
                <div className="auth-input">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id={`${id}-password`}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    aria-invalid={error && !formData.password ? 'true' : undefined}
                  />
                  <button type="button" className="auth-reveal" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && (
                <p id={`${id}-error`} className="auth-error" role="alert"><AlertCircle size={18} aria-hidden="true" /> {error}</p>
              )}

              <button type="submit" className="auth-primary" disabled={loading}>
                {loading ? <><Loader2 size={20} className="animate-spin" aria-hidden="true" /> กำลังเข้าสู่ระบบ…</> : <>เข้าสู่ระบบ <ArrowRight size={20} aria-hidden="true" /></>}
              </button>
            </form>

            <button type="button" className="auth-link" onClick={() => switchTo('sso')}>
              <ArrowLeft size={16} aria-hidden="true" /> กลับไปเข้าสู่ระบบด้วย PEA SSO
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;
