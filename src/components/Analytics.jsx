import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, Activity, Globe, Download, Upload, Shield, Play, Square, Search, CheckCircle2, XCircle, HelpCircle,
  Loader2, MapPin, Copy, Check, RefreshCw, AlertTriangle, X
} from 'lucide-react';
import { useSpeedTest, PHASE_LABEL, DOWNLOAD_WINDOW_MS, UPLOAD_WINDOW_MS } from './analytics/useSpeedTest';
import { useConnectionInfo, fetchJson, API_URL, TARGETS } from './analytics/useConnectionInfo';
import './ListPage.css';
import './Analytics.css';

const SNAPSHOT_PREFIX = 'analytics.snapshot.v1:';
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const ENDPOINT_STATE = {
  reachable: { label: 'ตอบสนอง', symbol: '✓', className: 'up' },
  unreachable: { label: 'ไม่ตอบสนอง', symbol: '!', className: 'down' },
  unknown: { label: 'ตรวจสอบไม่ได้', symbol: '?', className: 'unknown' },
  unchecked: { label: 'ยังไม่ได้ตรวจสอบ', symbol: '—', className: 'unknown' },
  loading: { label: 'กำลังตรวจสอบ', symbol: '…', className: 'unknown' }
};

const fmt = (value, digits = 1) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—');
const fmtTime = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleString('th-TH') : '');

const readSnapshot = (key) => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SNAPSHOT_PREFIX + key));
    const finished = raw?.lastTest?.finishedAt ? new Date(raw.lastTest.finishedAt) : null;
    const t = raw?.lastTest;
    const valid = t && [t.download, t.upload, t.latency].every(n => typeof n === 'number' && Number.isFinite(n)) && finished && !Number.isNaN(finished.getTime());
    return { ip: typeof raw?.ip === 'string' ? raw.ip.slice(0, 45) : '', lastTest: valid ? { download: t.download, upload: t.upload, latency: t.latency, finishedAt: finished } : null };
  } catch {
    return { ip: '', lastTest: null };
  }
};

const writeSnapshot = (key, snapshot) => {
  try { sessionStorage.setItem(SNAPSHOT_PREFIX + key, JSON.stringify(snapshot)); } catch { /* not remembered */ }
};

const clearOtherSnapshots = (keepKey) => {
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith(SNAPSHOT_PREFIX) && k !== SNAPSHOT_PREFIX + keepKey).forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
};

const copyText = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API needs HTTPS; plain-HTTP deployments fall back to execCommand.
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(area);
    return ok;
  }
};

const CopyButton = ({ value, label, disabled }) => {
  const [state, setState] = useState('idle');
  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <button type="button" className="list-button analytics-copy" disabled={disabled || !value}
      aria-label={`คัดลอก${label}`} onClick={async () => setState((await copyText(value)) ? 'copied' : 'failed')}>
      {state === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {state === 'copied' ? 'คัดลอกแล้ว' : state === 'failed' ? 'คัดลอกไม่ได้' : 'คัดลอก'}
    </button>
  );
};

const InfoRow = ({ icon, label, value, blurred, status, error, onRetry, copyLabel, note }) => (
  <div className="analytics-info-row">
    <div className="analytics-info-icon" aria-hidden="true">{icon}</div>
    <div className="analytics-info-body">
      <span className="analytics-info-label">{label}</span>
      {status === 'loading' && !value ? (
        <span className="list-muted"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> กำลังโหลด...</span>
      ) : value ? (
        <span className={`analytics-info-value${blurred ? ' is-blurred' : ''}`}>{value}</span>
      ) : (
        <span className="list-muted">ไม่ทราบ{status === 'error' ? ' (โหลดไม่สำเร็จ)' : ''}</span>
      )}
      {note && <span className="list-muted">{note}</span>}
      {status === 'error' && (
        <span className="analytics-inline-error" role="alert">{error} {onRetry && <button type="button" className="analytics-link-button" onClick={onRetry}>ลองใหม่</button>}</span>
      )}
    </div>
    {copyLabel && <CopyButton value={value} label={copyLabel} disabled={blurred} />}
  </div>
);

const Analytics = ({ user, token }) => {
  const userKey = String(user?.id ?? user?.username ?? 'guest');
  const [initial] = useState(() => readSnapshot(userKey));
  const [previous, setPrevious] = useState(initial.lastTest);
  const [ipInput, setIpInput] = useState(initial.ip);
  const [ipValidation, setIpValidation] = useState('');
  const [ipState, setIpState] = useState({ status: 'idle', ip: '', result: null, error: '' });
  const [save, setSave] = useState({ status: 'idle', message: '' });
  const ipRequestRef = useRef(0);
  const ipControllerRef = useRef(null);
  const deviceRef = useRef({ name: '', mac: '' });
  const lastResultRef = useRef(null);

  const saveReport = async (result) => {
    setSave({ status: 'saving', message: '' });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 15000);
    try {
      const res = await fetch(`${API_URL}/api/test/report`, {
        method: 'POST', headers, signal: timeout.signal,
        body: new URLSearchParams({
          download_speed: result.download.toFixed(1),
          upload_speed: result.upload.toFixed(1),
          latency: result.latency.toFixed(1),
          computer_name: deviceRef.current.name || 'N/A',
          mac_address: deviceRef.current.mac || 'N/A',
          user_id: user?.first_name || user?.username || 'Guest'
        }).toString()
      });
      let body = null;
      try { body = await res.json(); } catch { /* body optional */ }
      if (!res.ok || body?.success === false) {
        setSave({ status: 'failed', message: body?.message || `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}` });
      } else {
        setSave({ status: 'saved', message: '' });
      }
    } catch {
      // The request may have reached the server before the response was lost,
      // so this is deliberately not offered as a retry (could duplicate).
      setSave({ status: 'unconfirmed', message: 'ไม่ได้รับคำตอบจากเซิร์ฟเวอร์' });
    } finally {
      clearTimeout(timer);
    }
  };

  const speed = useSpeedTest({
    apiUrl: API_URL,
    onComplete: (result) => {
      setPrevious({ download: result.download, upload: result.upload, latency: result.latency, finishedAt: result.finishedAt });
      lastResultRef.current = result;
      saveReport(result);
    }
  });
  const { device, publicIp, endpoints, refreshAll, reloadDevice, reloadPublicIp, reloadEndpoints } = useConnectionInfo({ paused: speed.running });

  useEffect(() => { deviceRef.current = { name: device.name, mac: device.mac }; }, [device.name, device.mac]);
  useEffect(() => { clearOtherSnapshots(userKey); }, [userKey]);
  useEffect(() => {
    writeSnapshot(userKey, {
      ip: ipInput,
      lastTest: previous ? { ...previous, finishedAt: previous.finishedAt.toISOString() } : null
    });
  }, [userKey, ipInput, previous]);
  useEffect(() => () => ipControllerRef.current?.abort(), []);

  const showingPrevious = speed.phase === 'idle' && previous;
  const shown = showingPrevious ? previous : speed;
  const isPartial = speed.phase === 'cancelled' || speed.phase === 'failed';
  const blurred = !user;

  const submitIp = async (event) => {
    event.preventDefault();
    const ip = ipInput.trim();
    if (!IPV4.test(ip)) {
      setIpValidation('กรุณากรอกไอพีแบบ IPv4 ให้ถูกต้อง เช่น 172.30.204.33');
      return;
    }
    setIpValidation('');
    ipControllerRef.current?.abort();
    const controller = new AbortController();
    ipControllerRef.current = controller;
    const id = ipRequestRef.current + 1;
    ipRequestRef.current = id;
    setIpState({ status: 'loading', ip, result: null, error: '' });
    try {
      const body = await fetchJson(`${API_URL}/api/test/check-ip/${ip}`, {}, { signal: controller.signal });
      if (id !== ipRequestRef.current) return;
      const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
      const checkedAt = body.checked_at ? new Date(body.checked_at) : null;
      setIpState({
        status: 'done', ip, error: '',
        result: {
          alive: typeof body.alive === 'boolean' ? body.alive : null,
          latency: num(body.latency_ms ?? body.latency),
          packetLoss: num(body.packet_loss ?? body.packetLoss),
          checkedAt: checkedAt && !Number.isNaN(checkedAt.getTime()) ? checkedAt : null,
          site: body.site && typeof body.site === 'object' ? body.site : null
        }
      });
    } catch (err) {
      if (id !== ipRequestRef.current) return;
      setIpState({ status: 'error', ip, result: null, error: err.message });
    }
  };

  const clearIp = () => {
    ipControllerRef.current?.abort();
    ipRequestRef.current += 1;
    setIpInput('');
    setIpValidation('');
    setIpState({ status: 'idle', ip: '', result: null, error: '' });
  };

  const handleStart = () => { setSave({ status: 'idle', message: '' }); speed.start(); };
  const result = ipState.result;
  const ipChanged = ipState.ip && ipInput.trim() !== ipState.ip;

  return (
    <div className="list-page analytics-page">
      <header className="list-header">
        <div>
          <h1>ตรวจสอบการเชื่อมต่อ</h1>
          <p>ทดสอบความเร็วถึงเซิร์ฟเวอร์ของระบบ และตรวจสอบการตอบสนองของปลายทาง</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={refreshAll}>
            <RefreshCw size={18} aria-hidden="true" /> รีเฟรชข้อมูลการเชื่อมต่อ
          </button>
        </div>
      </header>

      <div className="analytics-grid">
        <section className="list-panel analytics-speed" aria-labelledby="speed-title">
          <h2 id="speed-title">ทดสอบความเร็ว</h2>
          <p className="list-muted">วัดระหว่างเบราว์เซอร์ของคุณกับเซิร์ฟเวอร์ของระบบ (ไม่ใช่ความเร็วอินเทอร์เน็ตภายนอก)</p>

          <div className="analytics-ring-wrap">
            <svg viewBox="0 0 100 100" className="analytics-ring" aria-hidden="true">
              <circle cx="50" cy="50" r="42" className="analytics-ring-track" />
              <circle cx="50" cy="50" r="42" className="analytics-ring-fill" strokeDasharray={`${(speed.progress / 100) * 264} 264`} />
            </svg>
            <div className="analytics-ring-center">
              <strong>{speed.running || speed.phase !== 'idle' ? `${speed.progress}%` : '—'}</strong>
              <span role="status">{PHASE_LABEL[speed.phase]}</span>
            </div>
          </div>
          <div className="analytics-progress" role="progressbar" aria-label="ความคืบหน้าการทดสอบ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={speed.progress}>
            <div style={{ width: `${speed.progress}%` }} />
          </div>

          {showingPrevious && <p className="analytics-note">ผลครั้งก่อน เมื่อ {fmtTime(previous.finishedAt)} — ยังไม่ได้ทดสอบใหม่ในครั้งนี้</p>}
          {isPartial && <p className="analytics-note analytics-note-warn" role="alert">{speed.phase === 'cancelled' ? 'คุณยกเลิกการทดสอบ' : `การทดสอบไม่สำเร็จ: ${speed.error}`} — ค่าที่แสดงเป็นผลบางส่วน ไม่ได้ทดสอบครบทุกขั้นตอน และไม่ได้บันทึกรายงาน</p>}

          <dl className="analytics-metrics">
            <div className="analytics-metric analytics-metric-download">
              <dt><Download size={18} aria-hidden="true" /> Download</dt>
              <dd><strong>{fmt(shown.download)}</strong> <span>Mbps</span></dd>
            </div>
            <div className="analytics-metric analytics-metric-upload">
              <dt><Upload size={18} aria-hidden="true" /> Upload</dt>
              <dd><strong>{fmt(shown.upload)}</strong> <span>Mbps</span></dd>
            </div>
            <div className="analytics-metric analytics-metric-latency">
              <dt><Activity size={18} aria-hidden="true" /> เวลาตอบกลับ</dt>
              <dd><strong>{fmt(shown.latency)}</strong> <span>ms</span></dd>
            </div>
          </dl>

          <div className="analytics-actions">
            {speed.running ? (
              <button type="button" className="list-button" onClick={speed.stop}><Square size={18} aria-hidden="true" /> หยุดการทดสอบ</button>
            ) : (
              <button type="button" className="list-button list-button-primary" onClick={handleStart}><Play size={18} aria-hidden="true" /> เริ่มทดสอบความเร็ว</button>
            )}
          </div>

          <div className="analytics-save" role="status">
            {save.status === 'saving' && <span><Loader2 size={16} className="animate-spin" aria-hidden="true" /> กำลังบันทึกรายงานผลทดสอบ...</span>}
            {save.status === 'saved' && <span className="analytics-ok"><Check size={16} aria-hidden="true" /> บันทึกรายงานผลทดสอบแล้ว</span>}
            {save.status === 'failed' && (
              <span className="analytics-bad"><AlertTriangle size={16} aria-hidden="true" /> บันทึกรายงานไม่สำเร็จ: {save.message}{' '}
                <button type="button" className="analytics-link-button" onClick={() => lastResultRef.current && saveReport(lastResultRef.current)}>บันทึกอีกครั้ง</button></span>
            )}
            {save.status === 'unconfirmed' && <span className="analytics-bad"><AlertTriangle size={16} aria-hidden="true" /> ยืนยันการบันทึกรายงานไม่ได้ ({save.message}) ผลทดสอบข้างต้นยังใช้ได้ — ระบบไม่ส่งซ้ำอัตโนมัติเพื่อกันรายงานซ้ำ</span>}
          </div>

          <ul className="analytics-method list-muted">
            <li>เวลาตอบกลับ: เวลา HTTP request ถึงเซิร์ฟเวอร์ ค่าเฉลี่ย 10 ครั้ง (ไม่ใช่ ICMP ping)</li>
            <li>Download/Upload: วัดต่อเนื่อง {DOWNLOAD_WINDOW_MS / 1000} วินาทีต่อขั้นตอน รวมเวลาวัดเวลาตอบกลับแล้วรอบทดสอบอาจนานกว่า {(DOWNLOAD_WINDOW_MS + UPLOAD_WINDOW_MS) / 1000} วินาที</li>
            <li>Upload คำนวณจากข้อมูลที่เบราว์เซอร์ส่งออกไป ไม่ใช่ค่าที่เซิร์ฟเวอร์ยืนยันว่ารับครบ</li>
          </ul>
        </section>

        <section className="list-panel analytics-info" aria-labelledby="info-title">
          <h2 id="info-title"><Shield size={20} aria-hidden="true" /> ข้อมูลการเชื่อมต่อ</h2>
          <InfoRow icon={<Globe size={18} />} label="Public IP (จากบริการภายนอก)" value={publicIp.ip} blurred={blurred} status={publicIp.status} error={publicIp.error} onRetry={reloadPublicIp} copyLabel="Public IP" />
          <InfoRow icon={<Zap size={18} />} label="ไอพีของคุณ (ที่เซิร์ฟเวอร์เห็น)" value={device.ip} blurred={blurred} status={device.status} error={device.error} onRetry={reloadDevice} copyLabel="ไอพีของคุณ" />
          <InfoRow icon={<Activity size={18} />} label="ชื่อเครื่อง" value={device.name} status={device.status === 'error' ? 'idle' : device.status} copyLabel="ชื่อเครื่อง" />
          <InfoRow icon={<Activity size={18} />} label="MAC Address" value={device.mac} blurred={blurred} status={device.status === 'error' ? 'idle' : device.status} copyLabel="MAC Address" />

          <h3>สถานะปลายทาง</h3>
          <p className="list-muted">ตรวจด้วย ping จากเซิร์ฟเวอร์ของระบบ ไม่ใช่จากเครื่องของคุณ · การไม่ตอบสนองไม่ได้ยืนยันว่าอุปกรณ์เสีย</p>
          {endpoints.status === 'error' && (
            <p className="analytics-inline-error" role="alert">
              อัปเดตไม่สำเร็จ: {endpoints.error}{endpoints.checkedAt && ` — แสดงผลล่าสุดเมื่อ ${fmtTime(endpoints.checkedAt)}`}{' '}
              <button type="button" className="analytics-link-button" onClick={reloadEndpoints}>ลองใหม่</button>
            </p>
          )}
          <ul className="analytics-endpoints">
            {TARGETS.map(({ ip, label }) => {
              const entry = endpoints.byIp[ip];
              const key = endpoints.status === 'loading' && entry.state === 'unchecked' ? 'loading' : entry.state;
              const meta = ENDPOINT_STATE[key];
              return (
                <li key={ip}>
                  <div>
                    <strong>{label}</strong>
                    <span className={`list-muted analytics-mono${blurred ? ' is-blurred' : ''}`}>{ip}{entry.latency !== null && ` (${entry.latency} ms)`}</span>
                  </div>
                  <span className={`list-status list-status-${meta.className}`}><span aria-hidden="true">{meta.symbol}</span> {meta.label}</span>
                </li>
              );
            })}
          </ul>
          {endpoints.checkedAt && <p className="list-muted">ตรวจล่าสุด {fmtTime(endpoints.checkedAt)} · อัปเดตทุก 30 วินาที{speed.running ? ' (พักระหว่างทดสอบความเร็ว)' : ''}</p>}
        </section>

        <section className="list-panel analytics-ipcheck" aria-labelledby="ip-title">
          <h2 id="ip-title"><Search size={20} aria-hidden="true" /> ตรวจสอบสถานะไอพี</h2>
          <form className="analytics-ip-form" onSubmit={submitIp} noValidate>
            <label className={`list-field${ipInput.trim() ? ' is-active' : ''}`}>
              <span>ไอพีที่ต้องการตรวจสอบ (IPv4)</span>
              <input type="text" inputMode="decimal" autoComplete="off" value={ipInput} placeholder="เช่น 172.30.204.33"
                aria-invalid={ipValidation ? 'true' : undefined} aria-describedby={ipValidation ? 'ip-validation' : undefined}
                onChange={(e) => { setIpInput(e.target.value); setIpValidation(''); }} />
            </label>
            <button type="submit" className="list-button list-button-primary" disabled={ipState.status === 'loading' || !ipInput.trim()}>
              {ipState.status === 'loading' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />} ตรวจสอบ
            </button>
            <button type="button" className="list-button" onClick={clearIp} disabled={!ipInput && ipState.status === 'idle'}><X size={18} aria-hidden="true" /> ล้าง</button>
          </form>
          {ipValidation && <p id="ip-validation" className="analytics-inline-error" role="alert">{ipValidation}</p>}
          <p className="list-muted">ตรวจด้วย ping จากเซิร์ฟเวอร์ของระบบ</p>

          {ipState.status === 'error' && <p className="analytics-inline-error" role="alert">ตรวจสอบ {ipState.ip} ไม่สำเร็จ: {ipState.error}</p>}
          {ipState.status === 'loading' && <p className="list-muted" role="status"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> กำลังตรวจสอบ {ipState.ip}...</p>}
          {result && (
            <div className={`analytics-ip-result analytics-ip-${result.alive === true ? 'up' : result.alive === false ? 'down' : 'unknown'}`} role="status">
              <div className="analytics-ip-head">
                {result.alive === true ? <CheckCircle2 size={28} aria-hidden="true" /> : result.alive === false ? <XCircle size={28} aria-hidden="true" /> : <HelpCircle size={28} aria-hidden="true" />}
                <div>
                  <strong className="analytics-mono">ผลของ {ipState.ip}</strong>
                  <span className="analytics-ip-state">{result.alive === true ? 'ตอบสนอง' : result.alive === false ? 'ไม่ตอบสนอง' : 'ตรวจสอบไม่ได้'}</span>
                </div>
              </div>
              {ipChanged && <p className="analytics-note">ไอพีที่กรอกเปลี่ยนไปแล้ว ผลนี้ยังเป็นของ {ipState.ip} — กด "ตรวจสอบ" เพื่อดูผลใหม่</p>}
              <dl className="analytics-ip-details">
                <div><dt>Latency</dt><dd>{result.latency !== null ? `${result.latency} ms` : '—'}</dd></div>
                <div><dt>Packet Loss</dt><dd>{result.packetLoss !== null ? `${result.packetLoss}%` : '—'}</dd></div>
                <div><dt>ตรวจเมื่อ</dt><dd>{fmtTime(result.checkedAt) || '—'}</dd></div>
              </dl>
              {result.alive === false && <p className="list-muted">การไม่ตอบ ping ไม่ได้ยืนยันว่าอุปกรณ์เสีย (อาจปิดการตอบ ping หรือถูกกั้นด้วยไฟร์วอลล์)</p>}
              {result.site && (result.site.pea_name || result.site.province) && (
                <p className="analytics-site"><MapPin size={16} aria-hidden="true" /> สังกัด: <strong>{result.site.pea_name || '—'}</strong>{result.site.province ? ` (${result.site.province})` : ''}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Analytics;
