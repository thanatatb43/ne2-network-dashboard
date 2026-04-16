import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Zap, Activity, Globe, Download, Upload, Shield, Info, Play } from 'lucide-react';

const Analytics = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({
    download: 0,
    upload: 0,
    latency: 0,
    jitter: 0
  });

  const runTest = () => {
    setIsTesting(true);
    setProgress(0);
    
    // Simulate speed test progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 2;
      setProgress(currentProgress);
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsTesting(false);
        setResults(prev => ({
          ...prev,
          download: (Math.random() * 800 + 100).toFixed(1),
          upload: (Math.random() * 400 + 50).toFixed(1),
          latency: (Math.random() * 20 + 5).toFixed(1),
          jitter: (Math.random() * 5 + 1).toFixed(1)
        }));
      }
    }, 50);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="analytics-page"
    >
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>Network Analytics</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>การวิเคราะห์ประสิทธิภาพการเชื่อมต่อและการวินิจฉัยโครงข่าย</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card glass" style={{ position: 'relative', overflow: 'hidden', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)' }}>
            <motion.div 
              style={{ height: '100%', background: 'var(--accent-primary)', width: `${progress}%` }} 
            />
          </div>

          <div style={{ position: 'relative', width: '280px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" stroke="url(#gauge-gradient)" strokeWidth="8" 
                strokeDasharray="283"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset: 283 - (283 * (isTesting ? (progress/100) : (results.download/1000))) }}
                transition={{ type: 'spring', damping: 20 }}
              />
              <defs>
                <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800 }}>{isTesting ? Math.floor(progress * 10) : results.download}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>Mb/s Download</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '3rem', marginTop: '2rem', width: '100%', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <Upload size={16} /> Upload
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{results.upload} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Mb/s</span></h3>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <Activity size={16} /> Latency
              </div>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{results.latency} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ms</span></h3>
            </div>
          </div>

          <button 
            onClick={runTest}
            disabled={isTesting}
            className="glass" 
            style={{ 
              marginTop: '2.5rem', 
              padding: '1rem 3rem', 
              borderRadius: '2rem',
              background: isTesting ? 'rgba(168, 85, 247, 0.1)' : 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: isTesting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s'
            }}
          >
            {isTesting ? 'Testing...' : <><Play size={18} fill="currentColor" /> Start Speed Test</>}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card glass">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)' }}>
                <Shield size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Connection Status</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>PEA HQ</p>
                  <p style={{ margin: '0.25rem 0 0', fontFamily: 'ui-monospace', fontWeight: 600 }}>172.30.204.33</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กฟฉ.2</p>
                  <p style={{ margin: '0.25rem 0 0', fontFamily: 'ui-monospace', fontWeight: 600 }}>172.21.1.18</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ระบบเครือข่ายภายนอก</p>
                  <p style={{ margin: '0.25rem 0 0', fontFamily: 'ui-monospace', fontWeight: 600 }}>8.8.8.8</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
              </div>
            </div>
          </div>

          <div className="card glass">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-secondary)' }}>
                <Zap size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Diagnostic Jitter</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>{results.jitter}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>ms</p>
            </div>
            <div style={{ marginTop: '1rem', height: '40px', display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
              {[...Array(20)].map((_, i) => (
                <div key={i} style={{ 
                  flex: 1, 
                  height: `${Math.random() * 80 + 20}%`, 
                  background: 'rgba(234, 179, 8, 0.3)', 
                  borderRadius: '1px' 
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', color: 'var(--text-secondary)' }}>
          <Info size={20} />
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          การวินิจฉัยโครงข่ายช่วยให้ระบุปัญหาความล่าช้าในเครือข่ายได้ทันที ระบบจะทำการวัดค่า Latency และ Jitter เพื่อประเมินคุณภาพสัญญาณ
        </p>
      </div>
    </motion.div>
  );
};

export default Analytics;
