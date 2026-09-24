import { useCallback, useEffect, useRef, useState } from 'react';

export const API_URL = import.meta.env.VITE_API_BASE_URL;
export const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 10000;

export const TARGETS = [
  { ip: '172.30.204.33', label: 'เครือข่ายภายใน (PEA HQ)' },
  { ip: '172.21.1.18', label: 'กฟฉ.2' },
  { ip: '8.8.8.8', label: 'เครือข่ายภายนอก (อินเทอร์เน็ต)' }
];

// Rejects on network failure, timeout, non-2xx (using the API's own message
// when it sends one) and non-JSON bodies, so callers never mistake a failed
// request for an empty/negative result.
export const fetchJson = async (url, init = {}, { signal } = {}) => {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal });
    let body = null;
    try { body = await res.json(); } catch { /* handled below */ }
    if (!res.ok) throw Object.assign(new Error(body?.message || `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}`), { http: true, status: res.status });
    if (body === null || typeof body !== 'object') throw new Error('รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง');
    if (body.success === false) throw Object.assign(new Error(body.message || 'ระบบตอบกลับว่าไม่สำเร็จ'), { http: true });
    return body;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(signal?.aborted ? 'ยกเลิกคำขอ' : 'หมดเวลารอการตอบกลับ');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');
const number = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

export const parseDevice = (body) => {
  const data = body.data && typeof body.data === 'object' ? body.data : body;
  return {
    ip: text(data.ip) || text(data.client_ip),
    name: text(data.hostname) || text(data.computer_name) || text(data.name),
    mac: text(data.mac_address) || text(data.mac) || text(data.physical_address)
  };
};

// A target the API didn't answer for stays "unknown" -- never online.
export const parseEndpoints = (body) => {
  if (!Array.isArray(body.data)) throw new Error('รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง');
  const byIp = {};
  TARGETS.forEach(({ ip }) => { byIp[ip] = { state: 'unknown', latency: null }; });
  body.data.forEach((item) => {
    if (!item || !byIp[item.ip] || typeof item.alive !== 'boolean') return;
    byIp[item.ip] = { state: item.alive ? 'reachable' : 'unreachable', latency: number(item.latency_ms ?? item.latency) };
  });
  return byIp;
};

const initialEndpoints = () => Object.fromEntries(TARGETS.map(({ ip }) => [ip, { state: 'unchecked', latency: null }]));

export function useConnectionInfo({ paused }) {
  const [device, setDevice] = useState({ status: 'loading', ip: '', name: '', mac: '', error: '' });
  const [publicIp, setPublicIp] = useState({ status: 'loading', ip: '', error: '' });
  const [endpoints, setEndpoints] = useState({ status: 'loading', byIp: initialEndpoints(), error: '', checkedAt: null });
  const pausedRef = useRef(paused);
  const lifeRef = useRef(null);
  const inflightRef = useRef({});
  const lastEndpointsOkRef = useRef(0);
  useEffect(() => { pausedRef.current = paused; });

  const guarded = useCallback(async (key, task) => {
    if (inflightRef.current[key]) return;
    const token = {};
    inflightRef.current[key] = token;
    try { await task(lifeRef.current.signal); } finally {
      if (inflightRef.current[key] === token) delete inflightRef.current[key];
    }
  }, []);

  const loadDevice = useCallback(() => guarded('device', async (signal) => {
    try {
      setDevice(d => ({ ...d, status: d.ip || d.name || d.mac ? d.status : 'loading', error: '' }));
      const body = await fetchJson(`${API_URL}/api/test/my-ip`, {}, { signal });
      if (!signal.aborted) setDevice({ status: 'ok', error: '', ...parseDevice(body) });
    } catch (err) {
      if (!signal.aborted) setDevice(d => ({ ...d, status: 'error', error: err.message }));
    }
  }), [guarded]);

  const loadPublicIp = useCallback(() => guarded('public', async (signal) => {
    try {
      setPublicIp(p => ({ ...p, status: p.ip ? p.status : 'loading', error: '' }));
      const body = await fetchJson('https://api.ipify.org?format=json', {}, { signal });
      if (!text(body.ip)) throw new Error('รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง');
      if (!signal.aborted) setPublicIp({ status: 'ok', ip: body.ip, error: '' });
    } catch (err) {
      if (!signal.aborted) setPublicIp(p => ({ ...p, status: 'error', error: err.message }));
    }
  }), [guarded]);

  const loadEndpoints = useCallback(() => guarded('endpoints', async (signal) => {
    try {
      const body = await fetchJson(`${API_URL}/api/test/ping-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ips: TARGETS.map(t => t.ip) })
      }, { signal });
      const byIp = parseEndpoints(body);
      lastEndpointsOkRef.current = Date.now();
      if (!signal.aborted) setEndpoints({ status: 'ok', byIp, error: '', checkedAt: new Date() });
    } catch (err) {
      // Keep the last good results; the banner says they are stale.
      if (!signal.aborted) setEndpoints(e => ({ ...e, status: 'error', error: err.message }));
    }
  }), [guarded]);

  useEffect(() => {
    lifeRef.current = new AbortController();
    loadDevice();
    loadPublicIp();
    let timer = 0;
    const tick = async () => {
      if (!document.hidden && !pausedRef.current) await loadEndpoints();
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    const onVisible = () => {
      if (!document.hidden && !pausedRef.current && Date.now() - lastEndpointsOkRef.current > POLL_INTERVAL_MS) loadEndpoints();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      lifeRef.current.abort();
      inflightRef.current = {};
    };
  }, [loadDevice, loadPublicIp, loadEndpoints]);

  const wasPausedRef = useRef(false);
  useEffect(() => {
    if (wasPausedRef.current && !paused) loadEndpoints();
    wasPausedRef.current = paused;
  }, [paused, loadEndpoints]);

  const refreshAll = useCallback(() => { loadDevice(); loadPublicIp(); loadEndpoints(); }, [loadDevice, loadPublicIp, loadEndpoints]);
  return { device, publicIp, endpoints, refreshAll, reloadDevice: loadDevice, reloadPublicIp: loadPublicIp, reloadEndpoints: loadEndpoints };
}
