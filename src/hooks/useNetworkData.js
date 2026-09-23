import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Attention-list thresholds -- common networking rules of thumb (packet
// loss >5% and latency >100ms are widely treated as warning signs), not an
// org-specific SLA. Flagged in the plan (section 8, "เกณฑ์เตือน latency/loss")
// as needing confirmation against a real operational standard.
const HIGH_LATENCY_MS = 100;
const HIGH_PACKET_LOSS_PCT = 5;

const REQUEST_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 60000;

// null/undefined/''/non-numeric all mean "no measurement", not 0 -- a
// missing latency reading is not the same as a 0ms one, and must never be
// silently counted as such in an average or a chart.
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toValidDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeDevice = (raw) => ({
  id: raw.device_id ?? raw.id,
  name: raw.device?.pea_name || 'ไม่ทราบชื่อสำนักงาน',
  province: raw.device?.province || '',
  peaType: raw.device?.pea_type || '',
  gateway: raw.device?.gateway || '',
  status: raw.status === 'up' || raw.status === 'down' ? raw.status : 'unknown',
  latency: toFiniteNumber(raw.latency_ms),
  packetLoss: toFiniteNumber(raw.packet_loss),
  checkedAt: toValidDate(raw.checked_at),
});

// /api/latency/metrics is expected to already be one row per device, but
// this groups by device_id and keeps only the record with the latest valid
// checked_at anyway, rather than trusting "first record seen" -- so a
// backend that ever returns more than one row per device can't silently
// show a stale status or the wrong latency for that device.
const dedupeLatest = (devices) => {
  const byId = new Map();
  for (const d of devices) {
    const existing = byId.get(d.id);
    if (!existing) { byId.set(d.id, d); continue; }
    const existingTime = existing.checkedAt?.getTime() ?? -Infinity;
    const currentTime = d.checkedAt?.getTime() ?? -Infinity;
    if (currentTime >= existingTime) byId.set(d.id, d);
  }
  return Array.from(byId.values());
};

const computeStats = (devices) => {
  let online = 0, down = 0, unknown = 0;
  let latencySum = 0, latencyCount = 0;
  let lossSum = 0, lossCount = 0;
  for (const d of devices) {
    if (d.status === 'up') online++;
    else if (d.status === 'down') down++;
    else unknown++;
    if (d.latency !== null) { latencySum += d.latency; latencyCount++; }
    if (d.packetLoss !== null) { lossSum += d.packetLoss; lossCount++; }
  }
  return {
    totalDevices: devices.length,
    onlineDevices: online,
    downDevices: down,
    unknownDevices: unknown,
    // Scope: every device with a valid measured value, regardless of
    // up/down/unknown status -- not just "online" devices -- so the sample
    // count and the total device count both mean "devices", consistently.
    avgLatency: { value: latencyCount ? latencySum / latencyCount : null, sampleCount: latencyCount },
    avgPacketLoss: { value: lossCount ? lossSum / lossCount : null, sampleCount: lossCount },
  };
};

// Devices that are down, or online but showing high packet loss / latency --
// in that priority order, then by how bad the reading is. There's no
// confirmed real probe interval from the backend (see
// NETWORK_DEVICES_IMPROVEMENT_PLAN.md section 8), so this deliberately does
// not try to flag readings as "stale" -- any such threshold would be a
// frontend guess, not something backed by the actual check schedule.
const buildAttentionList = (devices) => {
  const priority = { down: 0, high_loss: 1, high_latency: 2 };
  return devices
    .map((d) => {
      let reason = null;
      if (d.status === 'down') reason = 'down';
      else if (d.packetLoss !== null && d.packetLoss > HIGH_PACKET_LOSS_PCT) reason = 'high_loss';
      else if (d.latency !== null && d.latency > HIGH_LATENCY_MS) reason = 'high_latency';
      if (!reason) return null;
      return { ...d, reason };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (priority[a.reason] !== priority[b.reason]) return priority[a.reason] - priority[b.reason];
      if (a.reason === 'high_loss') return (b.packetLoss ?? 0) - (a.packetLoss ?? 0);
      if (a.reason === 'high_latency') return (b.latency ?? 0) - (a.latency ?? 0);
      return a.name.localeCompare(b.name, 'th');
    });
};

// Kept in strict chronological order with real timestamps (not just a
// display string) so the chart can show its actual covered time range
// instead of implying a fixed 24h/7d window that may not be backed by data.
const buildChartHistory = (points) => points
  .map((d) => {
    const minute = toValidDate(d.minute);
    return {
      timestamp: minute ? minute.getTime() : null,
      time: minute ? minute.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—',
      fullLabel: minute ? minute.toLocaleString('th-TH') : '—',
      latency: toFiniteNumber(d.avg_latency),
      packetLoss: toFiniteNumber(d.avg_packet_loss),
    };
  })
  .filter((d) => d.timestamp !== null)
  .sort((a, b) => a.timestamp - b.timestamp);

// One independent load function per endpoint (own AbortController, own
// in-flight guard, own loading/error/lastUpdated) so a chart-data failure
// never blanks out the stat cards, and vice versa -- same pattern
// Devices.jsx's fetchDevices already uses.
const useEndpoint = (path, mapResult) => {
  const [state, setState] = useState({ data: mapResult(null), loading: true, error: '', lastUpdated: null });
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, { signal: controller.signal });
      if (!res.ok) throw new Error('bad status');
      const json = await res.json();
      if (json.success === false || !Array.isArray(json.data)) throw new Error('bad shape');
      if (controllerRef.current !== controller) return;
      setState({ data: mapResult(json.data), loading: false, error: '', lastUpdated: new Date() });
    } catch (err) {
      if (controllerRef.current === controller && err.name !== 'AbortError') {
        setState((prev) => ({ ...prev, loading: false, error: 'โหลดข้อมูลไม่สำเร็จ' }));
      }
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, [load]);

  return [state, load];
};

export const useNetworkData = () => {
  const [metricsState, loadMetrics] = useEndpoint(
    '/api/latency/metrics',
    (data) => (data ? dedupeLatest(data.map(normalizeDevice)) : [])
  );
  const [summaryState, loadSummary] = useEndpoint('/api/latency/summary', (data) => data || []);

  const stats = useMemo(() => computeStats(metricsState.data), [metricsState.data]);
  const attentionList = useMemo(() => buildAttentionList(metricsState.data), [metricsState.data]);
  const chartHistory = useMemo(() => buildChartHistory(summaryState.data), [summaryState.data]);

  const refresh = useCallback(() => { loadMetrics(); loadSummary(); }, [loadMetrics, loadSummary]);

  return {
    stats,
    attentionList,
    chartHistory,
    metricsState: { loading: metricsState.loading, error: metricsState.error, lastUpdated: metricsState.lastUpdated },
    summaryState: { loading: summaryState.loading, error: summaryState.error, lastUpdated: summaryState.lastUpdated },
    refresh,
  };
};
