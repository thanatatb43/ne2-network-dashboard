import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, ArrowLeft, Loader2, ShieldCheck, KeyRound } from 'lucide-react';

const Auth = ({ onAuthSuccess }) => {
  const [screen, setScreen] = useState('sso'); // 'sso' (primary) or 'local' (username/password form)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const result = await response.json();

      if (result.success || result.token) {
        // Robustly extract user data and token from various possible response formats
        // Priority: nested 'user' > root result (if it has expected fields) > 'data' wrapper > fallback
        const userData = result.user || result.data?.user || (result.username ? result : result.data) || { username: formData.username };
        const userToken = result.token || result.data?.token || result.access_token || result.data?.access_token;

        // Ensure username is present for the sidebar display fallback
        if (typeof userData === 'object' && !userData?.username && formData.username) {
          userData.username = formData.username;
        }

        onAuthSuccess(userData, userToken);
      } else {
        setError(result.message || 'Failed to login');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Connection error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      minHeight: '100%',
      padding: '2rem 1rem'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card glass"
        style={{
          width: '100%',
          maxWidth: '550px',
          padding: '3rem',
          position: 'relative'
        }}
      >
        {/* Animated Background Accents */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
          opacity: 0.2,
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              display: 'inline-flex',
              padding: '1rem',
              borderRadius: '1rem',
              background: 'var(--glass-bg-subtle)',
              marginBottom: '1rem',
              color: 'var(--accent-primary)'
            }}>
              {screen === 'sso' ? <ShieldCheck size={32} /> : <KeyRound size={32} />}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
              เข้าสู่ระบบ
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              ระบบตรวจสอบสถานะอุปกรณ์เครือข่าย กฟฉ.2
            </p>
          </div>

          <AnimatePresence mode="wait">
            {screen === 'sso' ? (
              <motion.div
                key="sso"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                {/* Full browser navigation on purpose (not fetch/axios): the
                    backend needs to redirect the whole page through the PEA SSO
                    provider and back, which only works as a top-level navigation. */}
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL}/api/auth/sso/login`}
                  className="glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    padding: '1.1rem',
                    borderRadius: '0.75rem',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    textDecoration: 'none',
                    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
                  }}
                >
                  <ShieldCheck size={22} />
                  เข้าสู่ระบบด้วย PEA SSO
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.25rem 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>หรือ</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>

                <button
                  type="button"
                  onClick={() => setScreen('local')}
                  className="glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  <KeyRound size={18} color="var(--text-secondary)" />
                  เข้าสู่ระบบด้วยบัญชีผู้ใช้ภายใน
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="local"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                      Username
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        name="username"
                        required
                        placeholder="กรอกชื่อผู้ใช้"
                        value={formData.username}
                        onChange={handleChange}
                        className="glass-input"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem 0.75rem 2.8rem',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          borderRadius: '0.75rem',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="password"
                        name="password"
                        required
                        placeholder="กรอกรหัสผ่าน"
                        value={formData.password}
                        onChange={handleChange}
                        className="glass-input"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem 0.75rem 2.8rem',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          borderRadius: '0.75rem',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        color: 'var(--accent-danger)',
                        fontSize: '0.85rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        textAlign: 'center'
                      }}
                    >
                      {error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="glass"
                    style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        เข้าสู่ระบบ
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => { setScreen('sso'); setError(''); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    marginTop: '1.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={16} />
                  กลับไปเข้าสู่ระบบด้วย PEA SSO
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
