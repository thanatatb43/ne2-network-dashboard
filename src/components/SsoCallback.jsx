import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

// Landing page for the PEA SSO redirect. The backend sends the browser back
// here with #token=xxx&user=<url-encoded JSON> in the URL fragment (never in
// the query string or path, so it never gets logged server-side). This page
// just extracts that pair and hands it to the same onAuthSuccess used by the
// normal username/password login, so both flows end up in identical state.
const SsoCallback = ({ onAuthSuccess, onBackToLogin }) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const userRaw = params.get('user');

    if (!token || !userRaw) {
      setError('ไม่พบข้อมูลการเข้าสู่ระบบจาก PEA SSO กรุณาลองใหม่อีกครั้ง');
      return;
    }

    try {
      const userData = JSON.parse(userRaw);
      onAuthSuccess(userData, token, 'sso');
    } catch (err) {
      console.error('Failed to parse SSO user data:', err);
      setError('ข้อมูลผู้ใช้จาก PEA SSO ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  }, [onAuthSuccess]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1rem',
      textAlign: 'center'
    }}>
      {error ? (
        <>
          <AlertTriangle size={40} color="var(--accent-danger)" />
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>{error}</p>
          <button
            onClick={onBackToLogin}
            className="glass"
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </>
      ) : (
        <>
          <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
          <p style={{ color: 'var(--text-secondary)' }}>กำลังเข้าสู่ระบบผ่าน PEA SSO...</p>
        </>
      )}
    </div>
  );
};

export default SsoCallback;
