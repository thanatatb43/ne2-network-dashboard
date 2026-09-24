import { useCallback, useEffect, useRef, useState } from 'react';

export const REFRESH_INTERVAL_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;

export const STATUS_META = {
  up: { label: 'ออนไลน์', symbol: '✓', order: 2 },
  down: { label: 'ขัดข้อง', symbol: '!', order: 0 },
  unknown: { label: 'ไม่ทราบสถานะ', symbol: '?', order: 1 }
};

// Empty string, whitespace, NaN, Infinity and out-of-range values are all
// "no usable coordinate"; a real 0 stays valid (truthiness must not be used).
export const parseCoord = (value, limit) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

const parseLatency = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// The map only covers sites that have a monitored device with an IP; sites
// without one are not part of network monitoring and are left out entirely.
export const hasMonitoredDevice = (raw) => {
  const device = raw.network_device;
  return Boolean(device && typeof device === 'object' && device.id != null && String(device.gateway ?? '').trim());
};

export const normalizeSite = (raw, index) => {
  const device = raw.network_device;
  const rawStatus = device?.metrics?.status;
  const status = rawStatus === 'up' ? 'up' : rawStatus === 'down' ? 'down' : 'unknown';
  const lat = parseCoord(raw.latitude, 90);
  const lng = parseCoord(raw.longitude, 180);
  const hasCoords = lat !== null && lng !== null;
  return {
    id: raw.id ?? `site-${index}`,
    name: raw.pea_name ? String(raw.pea_name) : '(ไม่ระบุชื่อสำนักงาน)',
    province: raw.pea_province ? String(raw.pea_province) : '',
    type: raw.pea_type ? String(raw.pea_type) : '',
    hasCoords,
    position: hasCoords ? [lat, lng] : null,
    status,
    deviceId: device.id,
    deviceName: device.pea_name ? String(device.pea_name) : '',
    latency: parseLatency(device.metrics?.latency_ms),
    // Only surfaced if the backend actually sends a timestamp -- the page
    // load time is never presented as the measurement time.
    checkedAt: parseTime(device.metrics?.checked_at ?? device.metrics?.updated_at ?? device.metrics?.timestamp)
  };
};

export const countByStatus = (sites) => sites.reduce((acc, s) => {
  acc[s.status] += 1;
  return acc;
}, { up: 0, down: 0, unknown: 0 });

export function useSitesData() {
  const [state, setState] = useState({ sites: null, loading: true, refreshing: false, error: '', refreshError: '', loadedAt: null, incomplete: false });
  const controllerRef = useRef(null);
  const loadedAtRef = useRef(0);

  const load = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    setState(s => ({ ...s, refreshing: true, loading: s.sites === null }));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body && !Array.isArray(body) && body.success === false) throw new Error('API ตอบกลับว่าไม่สำเร็จ');
      const list = Array.isArray(body) ? body : body?.data;
      if (!Array.isArray(list) || list.some(item => !item || typeof item !== 'object')) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      if (controllerRef.current !== controller) return;
      const total = Number(body?.pagination?.total);
      loadedAtRef.current = Date.now();
      setState({
        sites: list.filter(hasMonitoredDevice).map(normalizeSite), loading: false, refreshing: false, error: '', refreshError: '',
        loadedAt: new Date(loadedAtRef.current), incomplete: Number.isFinite(total) && total > list.length
      });
    } catch (err) {
      if (controllerRef.current !== controller) return;
      const message = timedOut ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : (err.message || 'โหลดข้อมูลไม่สำเร็จ');
      console.error('Failed to load PEA sites:', err);
      setState(s => s.sites
        ? { ...s, refreshing: false, refreshError: message }
        : { ...s, loading: false, refreshing: false, error: message });
    } finally {
      clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => { if (!document.hidden) load(); }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden && Date.now() - loadedAtRef.current > REFRESH_INTERVAL_MS) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, [load]);

  return { ...state, reload: load };
}
