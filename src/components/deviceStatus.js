const finite = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

const validTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const TEXT_STATUS = { up: 'online', online: 'online', down: 'offline', offline: 'offline' };

// Backend precedence (meta.status_precedence): live_status -> alive -> status.
// live_status already folds in staleness (older than stale_after_seconds is
// "unknown"). The raw `status` is only the last measurement: it is used as
// the current state only when the backend sends neither live_status nor alive
// (older deployments) and is otherwise shown as "last measured ... at ...".
export const normalizeLiveStatus = (stats) => {
  if (!stats || typeof stats !== 'object') {
    return { status: 'unknown', latency: null, packetLoss: null, lastUpdated: null, stale: false, ageSeconds: null, lastMeasured: null, hasLiveContract: false };
  }
  const live = String(stats.live_status ?? '').trim().toLowerCase();
  const raw = TEXT_STATUS[String(stats.status ?? '').trim().toLowerCase()] || null;
  const hasLiveContract = live === 'up' || live === 'down' || live === 'unknown';
  let status = 'unknown';
  if (hasLiveContract) status = live === 'up' ? 'online' : live === 'down' ? 'offline' : 'unknown';
  else if (typeof stats.alive === 'boolean') status = stats.alive ? 'online' : 'offline';
  else if (raw) status = raw;
  return {
    status,
    latency: finite(stats.latency_ms ?? stats.latency),
    packetLoss: finite(stats.packet_loss ?? stats.packetLoss),
    // Only a timestamp from the source; never the time the page loaded.
    lastUpdated: validTime(stats.checked_at ?? stats.updated_at),
    stale: stats.stale === true,
    ageSeconds: finite(stats.age_seconds),
    lastMeasured: raw,
    hasLiveContract
  };
};

export const LIVE_STATUS_META = {
  online: { label: 'ออนไลน์', symbol: '✓', tone: 'up' },
  offline: { label: 'ขัดข้อง', symbol: '!', tone: 'down' },
  unknown: { label: 'ไม่ทราบสถานะ', symbol: '?', tone: 'unknown' },
  loading: { label: 'กำลังโหลด', symbol: '…', tone: 'unknown' }
};

export const formatAge = (seconds) => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 60) return 'ไม่ถึง 1 นาที';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ชม. ${minutes % 60} นาที`;
  return `${Math.floor(hours / 24)} วัน`;
};

// Adapter for list rows that expect up/down/unknown in `status`: replaces it
// with the current (live) state and keeps the raw last measurement aside.
export const withCurrentStatus = (row) => {
  const live = normalizeLiveStatus(row);
  const current = live.status === 'online' ? 'up' : live.status === 'offline' ? 'down' : 'unknown';
  return { ...row, measured_status: row?.status ?? null, status: current, stale: live.stale, age_seconds: live.ageSeconds };
};
