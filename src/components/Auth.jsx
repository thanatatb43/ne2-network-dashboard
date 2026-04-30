import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Mail, ArrowRight, Loader2, LogIn, UserPlus } from 'lucide-react';

const Auth = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    pea_branch: '',
    pea_division: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (mode === 'register') {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{10,}$/;
      if (!passwordRegex.test(formData.password)) {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 10 ตัวอักษร และประกอบด้วยตัวอักษรพิมพ์ใหญ่, พิมพ์เล็ก และอักขระพิเศษอย่างน้อยอย่างละ 1 ตัว');
        setLoading(false);
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setError('รหัสผ่านไม่ตรงกัน');
        setLoading(false);
        return;
      }
    }

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = mode === 'login' 
      ? { username: formData.username, password: formData.password }
      : { 
          username: formData.username, 
          password: formData.password,
          confirm_password: formData.confirm_password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          pea_branch: formData.pea_branch,
          pea_division: formData.pea_division
        };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        
        // Pass both user data and token up to App state
        if (mode === 'register' && !userToken) {
          setMode('login');
          setSuccessMessage('ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบด้วยบัญชีของคุณ');
          setFormData({ ...formData, password: '', confirm_password: '' });
        } else {
          onAuthSuccess(userData, userToken);
        }
      } else {
        setError(result.message || `Failed to ${mode}`);
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
              {mode === 'login' ? <LogIn size={32} /> : <UserPlus size={32} />}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
              {mode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียนผู้ใช้ใหม่'}
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {mode === 'login' 
                ? 'ระบบตรวจสอบสถานะอุปกรณ์เครือข่าย กฟฉ.2' 
                : 'กรอกข้อมูลเพื่อลงทะเบียนเข้าใช้งานระบบ'}
            </p>
          </div>

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

            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                {/* Name Fields */}
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                    ชื่อ (First Name)
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    required
                    placeholder="ชื่อ"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="glass-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                    นามสกุล (Last Name)
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    required
                    placeholder="นามสกุล"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="glass-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Workplace Fields */}
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                    สังกัด (Branch)
                  </label>
                  <input
                    type="text"
                    name="pea_branch"
                    required
                    placeholder="เช่น กฟฉ.2"
                    value={formData.pea_branch}
                    onChange={handleChange}
                    className="glass-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                    กอง/แผนก (Division)
                  </label>
                  <input
                    type="text"
                    name="pea_division"
                    required
                    placeholder="เช่น แผนกคอมฯ"
                    value={formData.pea_division}
                    onChange={handleChange}
                    className="glass-input"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
              </motion.div>
            )}

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

            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="input-group"
              >
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="password"
                    name="confirm_password"
                    required
                    placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                    value={formData.confirm_password}
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
              </motion.div>
            )}

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

            {successMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--accent-success)',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  textAlign: 'center'
                }}
              >
                {successMessage}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glass"
              style={{
                marginTop: '1rem',
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
                  {mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {mode === 'login' ? 'ยังไม่มีบัญชีผู้ใช้?' : 'มีบัญชีผู้ใช้อยู่แล้ว?'}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  marginLeft: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {mode === 'login' ? 'ลงทะเบียนที่นี่' : 'เข้าสู่ระบบที่นี่'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
