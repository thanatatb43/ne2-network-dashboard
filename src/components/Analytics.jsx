import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Zap, Activity, Globe, Download, Upload, Shield, Info, Play } from 'lucide-react';

const Analytics = ({ user, token }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({
    download: 0,
    upload: 0,
    latency: 0
  });
  const [testStatus, setTestStatus] = useState('');
  const [userIp, setUserIp] = useState('Fetching...');
  const [privateIp, setPrivateIp] = useState('Fetching...');
  const [computerName, setComputerName] = useState('N/A');
  const [macAddress, setMacAddress] = useState('N/A');
  const [endpointStatus, setEndpointStatus] = useState({
    '172.30.204.33': { online: true, latency: null },
    '172.21.1.18': { online: true, latency: null },
    '8.8.8.8': { online: true, latency: null }
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    // Fetch Public IP
    const fetchPublicIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        setUserIp(data.ip);
      } catch (err) {
        console.error('Failed to fetch public IP:', err);
        setUserIp('Unknown');
      }
    };

    // Fetch Private IP from Backend (includes Hostname and MAC)
    const fetchPrivateIp = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/my-ip`);
        const result = await res.json();

        // Handle various possible field names
        const data = result.data || result;
        setPrivateIp(data.ip || data.client_ip || 'N/A');
        setComputerName(data.hostname || data.computer_name || data.name || 'N/A');
        setMacAddress(data.mac_address || data.mac || data.physical_address || 'N/A');
      } catch (err) {
        console.error('Failed to fetch private IP/details from backend:', err);
        setPrivateIp('N/A');
      }
    };

    const fetchEndpointStatus = async () => {
      try {
        const ipsToCheck = ['172.30.204.33', '172.21.1.18', '8.8.8.8'];
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/ping-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ips: ipsToCheck })
        });
        const result = await res.json();

        if (result.success && result.data) {
          const newStatus = { ...endpointStatus };
          result.data.forEach(item => {
            if (newStatus[item.ip]) {
              newStatus[item.ip] = {
                online: item.alive === true,
                latency: item.latency_ms || item.latency
              };
            }
          });
          setEndpointStatus(newStatus);
        }
      } catch (err) {
        console.error('Failed to fetch endpoint status via ping-check:', err);
      }
    };

    fetchPublicIp();
    fetchPrivateIp();
    fetchEndpointStatus();

    // Polling for status
    const statusInterval = setInterval(fetchEndpointStatus, 30000);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(statusInterval);
    };
  }, []);

  const runTest = async () => {
    setIsTesting(true);
    setProgress(0);
    setTestStatus('Preparing test...');
    setResults({ download: 0, upload: 0, latency: 0 });

    const API_URL = import.meta.env.VITE_API_BASE_URL;

    let finalLatency = 0;
    let finalDownload = 0;
    let finalUpload = 0;

    try {
      // 1. Latency & Jitter Test (0% -> 25%)
      setTestStatus('ทดสอบ Latency...');
      const latencies = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await fetch(`${API_URL}/api/test/upload?_t=${Date.now()}`, { method: 'POST', body: '' });
        const end = performance.now();
        latencies.push(end - start);
        setProgress(Math.floor((i + 1) * 2.5));
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      finalLatency = avgLatency.toFixed(1);

      setResults(prev => ({ ...prev, latency: finalLatency }));
      setProgress(25);

      // 2. Download Test (25% -> 60%)
      setTestStatus('กำลังทดสอบความเร็ว Download...');
      const dlStart = performance.now();
      const dlResponse = await fetch(`${API_URL}/api/test/download?_cb=${Math.random()}`);
      const reader = dlResponse.body.getReader();
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.length;
        // Estimate progress during download
        const dlElapsed = (performance.now() - dlStart) / 1000;
        const currentSpeed = (receivedBytes * 8) / (dlElapsed * 1000000);
        setResults(prev => ({ ...prev, download: currentSpeed.toFixed(1) }));
        setProgress(Math.min(55, 25 + Math.floor((receivedBytes / (5 * 1024 * 1024)) * 30))); // Assuming ~5MB test file
      }
      const dlEnd = performance.now();
      const dlDuration = (dlEnd - dlStart) / 1000;
      const finalDlSpeed = (receivedBytes * 8) / (dlDuration * 1000000);
      finalDownload = finalDlSpeed.toFixed(1);
      setResults(prev => ({ ...prev, download: finalDownload }));
      setProgress(60);

      // 3. Upload Test (60% -> 100%)
      setTestStatus('กำลังทดสอบความเร็ว Upload (40MB)...');
      const uploadSize = 40 * 1024 * 1024; // 40MB
      const dummyData = new Uint8Array(uploadSize);

      // Fill efficiently by creating a 1MB random chunk and copying it
      const mbChunk = new Uint8Array(1024 * 1024);
      for (let i = 0; i < mbChunk.length; i += 65536) {
        window.crypto.getRandomValues(mbChunk.subarray(i, i + Math.min(65536, mbChunk.length - i)));
      }
      for (let i = 0; i < uploadSize; i += mbChunk.length) {
        dummyData.set(mbChunk.subarray(0, Math.min(mbChunk.length, uploadSize - i)), i);
      }

      const ulStart = performance.now();
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/api/test/upload`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.loaded > 0) {
            const ulElapsed = (performance.now() - ulStart) / 1000;
            if (ulElapsed > 0.1) {
              const currentSpeed = (event.loaded * 8) / (ulElapsed * 1000000);
              setResults(prev => ({ ...prev, upload: currentSpeed.toFixed(1) }));
            }
            setProgress(60 + Math.floor((event.loaded / event.total) * 40));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const ulEnd = performance.now();
            const ulDuration = (ulEnd - ulStart) / 1000;
            const ulSpeed = (uploadSize * 8) / (ulDuration * 1000000);
            finalUpload = ulSpeed.toFixed(1);
            setResults(prev => ({ ...prev, upload: finalUpload }));
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        xhr.send(dummyData);
      });

      setProgress(100);
      setTestStatus('ทดสอบเสร็จสิ้น');

      // Send the report
      try {
        const qs = { stringify: (obj) => new URLSearchParams(obj).toString() };
        const data = qs.stringify({
          download_speed: finalDownload,
          upload_speed: finalUpload,
          latency: finalLatency,
          computer_name: computerName,
          mac_address: macAddress,
          user_id: user?.first_name || user?.username || 'Guest'
        });

        const headers = {
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        await fetch(`${API_URL}/api/test/report`, {
          method: 'POST',
          headers,
          body: data
        });
      } catch (reportErr) {
        console.error('Failed to send report:', reportErr);
      }

    } catch (err) {
      console.error('Speed test failed:', err);
      setTestStatus('Test failed - check connection');
    } finally {
      setIsTesting(false);
    }
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

          {/* Speed Indicator Gauge */}
          <div style={{ position: 'relative', width: '320px', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Animated Glow Background */}
            <AnimatePresence>
              {isTesting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    zIndex: 0
                  }}
                />
              )}
            </AnimatePresence>

            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-195deg)', zIndex: 1 }}>
              {/* Background Track - 210 degrees of a 264 circumference circle */}
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="var(--border-subtle)" strokeWidth="6"
                strokeDasharray="154 264" strokeLinecap="round"
              />
              {/* Progress Track */}
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#speed-gradient)" strokeWidth="6"
                strokeDasharray="154 264" strokeLinecap="round"
                initial={{ strokeDashoffset: 154 }}
                animate={{
                  strokeDashoffset: 154 - (154 * (
                    isTesting
                      ? (testStatus.includes('Upload') ? Math.min(results.upload / 1000, 1) : (testStatus.includes('Download') ? Math.min(results.download / 1000, 1) : progress / 100))
                      : Math.min(results.download / 1000, 1)
                  ))
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 50 }}
              />
              <defs>
                <linearGradient id="speed-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent-primary)" />
                  <stop offset="100%" stopColor="var(--accent-secondary)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Central Values */}
            <div style={{ position: 'absolute', textAlign: 'center', zIndex: 2 }}>
              <motion.div
                key={isTesting ? 'testing' : 'idle'}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <h2 style={{ fontSize: '4.5rem', margin: 0, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>
                  {isTesting
                    ? (testStatus.includes('Upload') ? results.upload : (testStatus.includes('Download') ? results.download : Math.floor(progress * 10)))
                    : (results.download > 0 ? results.download : 0)}
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {isTesting && testStatus.includes('Upload') ? 'Mb/s Upload' : 'Mb/s Download'}
                </p>
              </motion.div>

              <AnimatePresence>
                {testStatus && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      margin: '1rem 0 0',
                      color: 'var(--accent-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      background: 'var(--bg-accent-subtle)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '1rem',
                      display: 'inline-block'
                    }}
                  >
                    {testStatus}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem', width: '100%', maxWidth: '500px' }}>
            <motion.div
              whileHover={{ y: -4 }}
              className="glass"
              style={{ padding: '1.25rem', borderRadius: '1.25rem', textAlign: 'center', background: 'var(--glass-bg-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <Upload size={18} color="var(--accent-secondary)" /> Upload
              </div>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
                {results.upload} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Mb/s</span>
              </h3>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              className="glass"
              style={{ padding: '1.25rem', borderRadius: '1.25rem', textAlign: 'center', background: 'var(--glass-bg-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <Activity size={18} color="var(--accent-primary)" /> Latency
              </div>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>
                {results.latency} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ms</span>
              </h3>
            </motion.div>
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
          <div className="card glass" style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--accent-primary)', padding: '0.6rem', borderRadius: '0.75rem', color: '#fff', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)' }}>
                <Shield size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Connection Details</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live network diagnostics</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Public IP */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '0.2rem', color: 'var(--accent-primary)' }}><Globe size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Public Network</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-success)', fontWeight: 800, background: 'rgba(52, 211, 153, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '1rem', border: '1px solid rgba(52, 211, 153, 0.2)' }}>ACTIVE</span>
                  </div>
                  <p style={{
                    margin: 0, fontFamily: 'ui-monospace', fontWeight: 700, fontSize: '1.1rem',
                    filter: !user ? 'blur(4px)' : 'none', transition: 'filter 0.3s'
                  }}>{userIp}</p>
                </div>
              </div>

              {/* Private IP */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '0.2rem', color: 'var(--accent-secondary)' }}><Zap size={18} /></div>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem' }}>ไอพีของคุณคือ</span>
                  <p style={{
                    margin: 0, fontFamily: 'ui-monospace', fontWeight: 700, fontSize: '1.1rem',
                    filter: !user ? 'blur(4px)' : 'none', transition: 'filter 0.3s'
                  }}>{privateIp}</p>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />

              {/* Host & MAC */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Hostname</span>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{computerName}</p>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Physical Addr</span>
                  <p style={{
                    margin: 0, fontFamily: 'ui-monospace', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)',
                    filter: !user ? 'blur(4px)' : 'none'
                  }}>{macAddress}</p>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />

              {/* Ping Endpoints */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'เครือข่ายภายใน (PEA HQ)', ip: '172.30.204.33' },
                  { label: 'กฟฉ.2', ip: '172.21.1.18' },
                  { label: 'สถานะเชื่อมต่อเครือข่ายภายนอก', ip: '8.8.8.8' }
                ].map((endpoint, i) => {
                  const status = endpointStatus[endpoint.ip] || { online: true };
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{endpoint.label}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'ui-monospace', filter: !user ? 'blur(4px)' : 'none' }}>
                          {endpoint.ip} {status.latency ? `(${status.latency}ms)` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: status.online ? 'var(--accent-success)' : 'var(--accent-danger)',
                          boxShadow: `0 0 8px ${status.online ? 'var(--accent-success)' : 'var(--accent-danger)'}`
                        }} />
                        <span style={{
                          fontSize: '0.7rem',
                          color: status.online ? 'var(--accent-success)' : 'var(--accent-danger)',
                          fontWeight: 700
                        }}>
                          {status.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', color: 'var(--text-secondary)' }}>
          <Info size={20} />
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          การวินิจฉัยโครงข่ายช่วยให้ระบุปัญหาความล่าช้าในเครือข่ายได้ทันที ระบบจะทำการวัดค่า Latency เพื่อประเมินคุณภาพสัญญาณ
        </p>
      </div>
    </motion.div>
  );
};

export default Analytics;
