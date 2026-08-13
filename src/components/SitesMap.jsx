import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, AlertTriangle, MapPin, Wifi, WifiOff, Maximize, Minimize } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Refetch the sites/device status on the same cadence as the rest of the
// dashboard (Sidebar's System Status widget, the Devices page).
const REFRESH_INTERVAL_MS = 60000;

// Default center: roughly the middle of PEA เขต 2 (Khon Kaen area), used only
// when no site has usable coordinates yet.
const DEFAULT_CENTER = [16.4322, 102.8236];

const statusOf = (site) => (site.network_device.metrics?.status === 'up' ? 'up' : 'down');

const STATUS_COLOR = { up: '#22c55e', down: '#ef4444' };

// Colored-dot marker via a plain divIcon instead of Leaflet's default image
// icon -- sidesteps the well-known bundler asset-path issue with Leaflet's
// default marker PNGs, and lets the color reflect device status directly.
const markerIconCache = {};
const markerIconFor = (status) => {
  if (markerIconCache[status]) return markerIconCache[status];
  const color = STATUS_COLOR[status];
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
  markerIconCache[status] = icon;
  return icon;
};

// Leaflet needs an explicit nudge after its container resizes outside of a
// window resize event (e.g. entering/exiting fullscreen) or it keeps
// rendering tiles at the old size until the user pans/zooms.
const MapResizer = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [trigger, map]);
  return null;
};

const SitesMap = ({ onDeviceClick }) => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [peaTypeFilter, setPeaTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapCardRef = useRef(null);

  useEffect(() => {
    const fetchSites = async (isBackground) => {
      if (!isBackground) setLoading(true);
      setError('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites`);
        const result = await res.json();
        const list = result.data || result;
        setSites(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load PEA sites:', err);
        // A background refresh failing shouldn't blank out an already-loaded
        // map with an error screen -- just keep showing the last good data.
        if (!isBackground) setError('ไม่สามารถโหลดข้อมูลสำนักงานได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        if (!isBackground) setLoading(false);
      }
    };
    fetchSites(false);
    const interval = setInterval(() => fetchSites(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      mapCardRef.current?.requestFullscreen();
    }
  };

  const sitesWithCoords = useMemo(
    () => sites.filter(s => s.latitude != null && s.longitude != null && s.network_device),
    [sites]
  );

  // Filter dropdown options are derived from whatever data actually comes
  // back, rather than a hardcoded list, since the set of provinces/pea_type
  // values isn't fixed.
  const provinces = useMemo(
    () => Array.from(new Set(sites.map(s => s.pea_province).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [sites]
  );
  const peaTypes = useMemo(
    () => Array.from(new Set(sites.map(s => s.pea_type).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [sites]
  );

  const filteredSitesWithCoords = useMemo(() => sitesWithCoords.filter(site => {
    if (provinceFilter !== 'all' && site.pea_province !== provinceFilter) return false;
    if (peaTypeFilter !== 'all' && site.pea_type !== peaTypeFilter) return false;
    if (statusFilter !== 'all' && statusOf(site) !== statusFilter) return false;
    return true;
  }), [sitesWithCoords, provinceFilter, peaTypeFilter, statusFilter]);

  const hasActiveFilter = provinceFilter !== 'all' || peaTypeFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setProvinceFilter('all');
    setPeaTypeFilter('all');
    setStatusFilter('all');
  };

  // Fixed to the full unfiltered set so the map doesn't jump/re-center every
  // time a filter narrows the marker list -- react-leaflet only reads
  // center/zoom on initial mount anyway.
  const center = useMemo(() => {
    if (sitesWithCoords.length === 0) return DEFAULT_CENTER;
    const avgLat = sitesWithCoords.reduce((sum, s) => sum + Number(s.latitude), 0) / sitesWithCoords.length;
    const avgLng = sitesWithCoords.reduce((sum, s) => sum + Number(s.longitude), 0) / sitesWithCoords.length;
    return [avgLat, avgLng];
  }, [sitesWithCoords]);

  const counts = useMemo(() => filteredSitesWithCoords.reduce((acc, s) => {
    acc[statusOf(s)] += 1;
    return acc;
  }, { up: 0, down: 0 }), [filteredSitesWithCoords]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <header className="dashboard-header-title-wrap" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="dashboard-header-title" style={{ margin: 0, fontWeight: 700 }}>แผนที่สำนักงาน กฟฉ.2</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>สถานะอุปกรณ์เครือข่ายของแต่ละสำนักงานบนแผนที่</p>
        </div>
        {!loading && !error && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR.up }} /> Online ({counts.up})
            </div>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR.down }} /> Offline ({counts.down})
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem' }}>กำลังโหลดข้อมูลสำนักงาน...</p>
        </div>
      ) : error ? (
        <div className="card glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertTriangle size={40} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>จังหวัด:</span>
              <select
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                {provinces.map(p => (
                  <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{p}</option>
                ))}
              </select>
            </div>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
              <select
                value={peaTypeFilter}
                onChange={(e) => setPeaTypeFilter(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                {peaTypes.map(t => (
                  <option key={t} value={t} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{t}</option>
                ))}
              </select>
            </div>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะอุปกรณ์:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                <option value="up" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>Online</option>
                <option value="down" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>Offline</option>
              </select>
            </div>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="glass"
                style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div
            ref={mapCardRef}
            className="card glass"
            style={{
              padding: 0, overflow: 'hidden', borderRadius: isFullscreen ? 0 : '0.75rem',
              height: isFullscreen ? '100vh' : '600px', position: 'relative',
              background: isFullscreen ? '#0f172a' : undefined
            }}
          >
            <button
              onClick={toggleFullscreen}
              className="glass"
              title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'ขยายเต็มจอ'}
              style={{
                position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 1000,
                padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                color: 'var(--text-primary)', cursor: 'pointer', display: 'flex'
              }}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            {filteredSitesWithCoords.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <MapPin size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>{hasActiveFilter ? 'ไม่พบสำนักงานที่ตรงกับตัวกรอง' : 'ยังไม่มีสำนักงานที่ระบุพิกัด'}</p>
              </div>
            ) : (
              <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <MapResizer trigger={isFullscreen} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {filteredSitesWithCoords.map(site => {
                  const status = statusOf(site);
                  return (
                    <Marker
                      key={site.id}
                      position={[Number(site.latitude), Number(site.longitude)]}
                      icon={markerIconFor(status)}
                    >
                      <Popup>
                        <div style={{ minWidth: '160px' }}>
                          <strong>{site.pea_name}</strong>
                          {site.pea_province && <div style={{ fontSize: '0.85rem', color: '#555' }}>{site.pea_province}</div>}
                          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {status === 'up' ? (
                              <><Wifi size={14} color={STATUS_COLOR.up} /> {site.network_device.pea_name} · Online{site.network_device.metrics?.latency_ms != null && ` (${site.network_device.metrics.latency_ms}ms)`}</>
                            ) : (
                              <><WifiOff size={14} color={STATUS_COLOR.down} /> {site.network_device.pea_name} · Offline</>
                            )}
                          </div>
                          {onDeviceClick && (
                            <button
                              onClick={() => onDeviceClick(site.network_device.id)}
                              style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#a855f7', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                            >
                              ดูรายละเอียดอุปกรณ์ →
                            </button>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default SitesMap;
