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

    fetchPublicIp();
    fetchPrivateIp();

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
      setTestStatus('Measuring Latency...');
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
      setTestStatus('Testing Download Speed...');
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
      setTestStatus('Testing Upload Speed (40MB)...');
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
      setTestStatus('Test Complete');

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

          <div style={{ position: 'relative', width: '280px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" stroke="url(#gauge-gradient)" strokeWidth="8" 
                strokeDasharray="283"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset: 283 - (283 * (
                  isTesting 
                    ? (testStatus.includes('Upload') ? Math.min(results.upload / 1000, 1) : (testStatus.includes('Download') ? Math.min(results.download / 1000, 1) : progress / 100)) 
                    : Math.min(results.download / 1000, 1)
                )) }}
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
              <h2 style={{ fontSize: '3.5rem', margin: 0, fontWeight: 800 }}>
                {isTesting 
                  ? (testStatus.includes('Upload') ? results.upload : (testStatus.includes('Download') ? results.download : Math.floor(progress * 10))) 
                  : (results.download > 0 ? results.download : 0)}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>
                {isTesting && testStatus.includes('Upload') ? 'Mb/s Upload' : 'Mb/s Download'}
              </p>
              {testStatus && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ margin: '0.5rem 0 0', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {testStatus}
                </motion.p>
              )}
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
                  <p style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Public IP</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600, 
                    fontSize: '1rem',
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>{userIp}</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ACTIVE</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>Private IP</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600, 
                    fontSize: '1rem',
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>{privateIp}</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Computer Name</p>
                  <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9rem' }}>{computerName}</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>MAC Address</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600, 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)',
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>{macAddress}</p>
                </div>
              </div>
              <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>PEA HQ</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600,
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>172.30.204.33</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กฟฉ.2</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600,
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>172.21.1.18</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ระบบเครือข่ายภายนอก</p>
                  <p style={{ 
                    margin: '0.25rem 0 0', 
                    fontFamily: 'ui-monospace', 
                    fontWeight: 600,
                    filter: !user ? 'blur(4px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: !user ? 'none' : 'auto'
                  }}>8.8.8.8</p>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-success)', fontWeight: 700, background: 'rgba(52, 211, 153, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ONLINE</div>
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
