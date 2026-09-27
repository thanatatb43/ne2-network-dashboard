const finite = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

const validTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// up/down only from explicit evidence (alive flag or status text). Missing
// or unrecognised data is "unknown", never "online" and never "offline".
export const normalizeLiveStatus = (stats) => {
  if (!stats || typeof stats !== 'object') return { status: 'unknown', latency: null, packetLoss: null, lastUpdated: null };
  const text = String(stats.status ?? '').trim().toLowerCase();
  let status = 'unknown';
  if (typeof stats.alive === 'boolean') status = stats.alive ? 'online' : 'offline';
  else if (text === 'up' || text === 'online') status = 'online';
  else if (text === 'down' || text === 'offline') status = 'offline';
  return {
    status,
    latency: finite(stats.latency_ms ?? stats.latency),
    packetLoss: finite(stats.packet_loss ?? stats.packetLoss),
    // Only a timestamp from the source; never the time the page loaded.
    lastUpdated: validTime(stats.checked_at ?? stats.updated_at)
  };
};

export const LIVE_STATUS_META = {
  online: { label: 'ออนไลน์', symbol: '✓', tone: 'up' },
  offline: { label: 'ขัดข้อง', symbol: '!', tone: 'down' },
  unknown: { label: 'ไม่ทราบสถานะ', symbol: '?', tone: 'unknown' },
  loading: { label: 'กำลังโหลด', symbol: '…', tone: 'unknown' }
};
