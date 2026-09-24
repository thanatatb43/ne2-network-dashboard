import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, AlertTriangle, MapPin, Maximize, Minimize, RefreshCw, Search, List, Map as MapIcon, LocateFixed } from 'lucide-react';
import { STATUS_META, countByStatus, useSitesData } from './sitesMapData';
import 'leaflet/dist/leaflet.css';
import './ListPage.css';
import './SitesMap.css';

// Roughly the middle of PEA เขต 2 (Khon Kaen area), used only when no site
// has a usable coordinate.
const DEFAULT_CENTER = [16.4322, 102.8236];
const DEFAULT_ZOOM = 8;
const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;
const CONTEXT_KEY = 'sitesMap.context.v1';
const STATUS_FILTERS = ['up', 'down', 'unknown'];

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const readContext = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CONTEXT_KEY));
    const [lat, lng] = raw?.center || [];
    const validCenter = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
    const validZoom = Number.isFinite(raw?.zoom) && raw.zoom >= 1 && raw.zoom <= 19;
    return {
      viewport: validCenter && validZoom ? { center: [lat, lng], zoom: raw.zoom } : null,
      selectedId: raw?.selectedId ?? null
    };
  } catch {
    return { viewport: null, selectedId: null };
  }
};

const writeContext = (patch) => {
  try {
    const current = JSON.parse(sessionStorage.getItem(CONTEXT_KEY)) || {};
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* storage unavailable: context just isn't remembered */ }
};

const readUrlState = () => {
  const p = new URLSearchParams(window.location.search);
  const status = p.get('status');
  return {
    query: p.get('q') || '',
    province: p.get('province') || '',
    type: p.get('type') || '',
    status: STATUS_FILTERS.includes(status) ? status : 'all',
    view: p.get('view') === 'list' ? 'list' : 'map'
  };
};

const iconCache = {};
const pinIcon = (status, selected) => {
  const key = `${status}-${selected}`;
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: 'sites-pin-wrap',
      html: `<span class="sites-pin sites-pin-${status}${selected ? ' is-selected' : ''}" aria-hidden="true">${STATUS_META[status].symbol}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18]
    });
  }
  return iconCache[key];
};

const fitPoints = (map, points, animate) => {
  if (!points.length || map.getContainer().clientWidth === 0) return false;
  if (points.length === 1) map.setView(points[0], 12, { animate });
  else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13, animate });
  return true;
};

// Bridges Leaflet's imperative API to the React tree: exposes the map
// instance, does the one-time initial fit, remembers the viewport, and
// re-measures the container whenever its size changes for ANY reason
// (sidebar toggle, list/map switch, fullscreen), not just window resize.
const MapBridge = ({ mapRef, allPoints, hasSavedViewport }) => {
  const map = useMap();
  const fittedRef = useRef(hasSavedViewport);
  const pointsRef = useRef(allPoints);
  useEffect(() => { pointsRef.current = allPoints; });

  useEffect(() => {
    mapRef.current = map;
    const tryFit = () => {
      if (fittedRef.current || !pointsRef.current.length) return;
      fittedRef.current = fitPoints(map, pointsRef.current, false);
    };
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { map.invalidateSize(); tryFit(); });
    });
    observer.observe(map.getContainer());
    tryFit();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      mapRef.current = null;
    };
  }, [map, mapRef]);

  useEffect(() => {
    if (fittedRef.current || !allPoints.length) return;
    fittedRef.current = fitPoints(map, allPoints, false);
  }, [allPoints, map]);

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      writeContext({ center: [c.lat, c.lng], zoom: map.getZoom() });
    }
  });
  return null;
};

const StatusPill = ({ status }) => (
  <span className={`list-status list-status-${status}`}>
    <span aria-hidden="true">{STATUS_META[status].symbol}</span> {STATUS_META[status].label}
  </span>
);

const SitesMap = ({ onDeviceClick }) => {
  const { sites, loading, refreshing, error, refreshError, loadedAt, incomplete, reload } = useSitesData();

  const [initial] = useState(() => ({ ...readUrlState(), ...readContext() }));
  const [searchInput, setSearchInput] = useState(initial.query);
  const [query, setQuery] = useState(initial.query);
  const [province, setProvince] = useState(initial.province);
  const [type, setType] = useState(initial.type);
  const [status, setStatus] = useState(initial.status);
  const [view, setView] = useState(initial.view);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [focusRequest, setFocusRequest] = useState(null);
  const [pageState, setPageState] = useState({ key: '', count: PAGE_SIZE });
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tileError, setTileError] = useState(false);

  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const mapCardRef = useRef(null);
  const fullscreenButtonRef = useRef(null);
  const restoredRef = useRef(false);
  const isFullscreen = nativeFullscreen || expanded;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (window.location.pathname !== '/') return;
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (province) p.set('province', province);
    if (type) p.set('type', type);
    if (status !== 'all') p.set('status', status);
    if (view === 'list') p.set('view', 'list');
    const qs = p.toString();
    const next = `/${qs ? `?${qs}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', next);
  }, [query, province, type, status, view]);

  useEffect(() => { writeContext({ selectedId }); }, [selectedId]);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement === mapCardRef.current;
      setNativeFullscreen(active);
      if (!active) fullscreenButtonRef.current?.focus();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement?.classList.contains('sites-map-card')) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { setExpanded(false); fullscreenButtonRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setExpanded(false);
      if (document.fullscreenElement === mapCardRef.current) {
        try { await document.exitFullscreen(); } catch { /* already exited */ }
      } else {
        fullscreenButtonRef.current?.focus();
      }
      return;
    }
    const card = mapCardRef.current;
    if (!card?.requestFullscreen) { setExpanded(true); return; }
    try { await card.requestFullscreen(); } catch { setExpanded(true); }
  };

  const allSites = useMemo(() => sites || [], [sites]);
  const totals = useMemo(() => countByStatus(allSites), [allSites]);
  const allPoints = useMemo(() => allSites.filter(s => s.hasCoords).map(s => s.position), [allSites]);

  const provinces = useMemo(
    () => Array.from(new Set(allSites.map(s => s.province).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [allSites]
  );
  const types = useMemo(
    () => Array.from(new Set(allSites.map(s => s.type).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [allSites]
  );

  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase();
    return allSites.filter(s => {
      if (province && s.province !== province) return false;
      if (type && s.type !== type) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (needle && !`${s.name} ${s.province} ${s.type}`.toLocaleLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allSites, query, province, type, status]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => STATUS_META[a.status].order - STATUS_META[b.status].order || a.name.localeCompare(b.name, 'th')),
    [filtered]
  );
  const mappable = useMemo(() => filtered.filter(s => s.hasCoords), [filtered]);
  const withoutCoords = filtered.length - mappable.length;
  const filterKey = `${query}|${province}|${type}|${status}`;
  const visibleCount = pageState.key === filterKey ? pageState.count : PAGE_SIZE;
  const activeSelectedId = mappable.some(s => s.id === selectedId) ? selectedId : null;
  const hasActiveFilter = Boolean(searchInput || province || type || status !== 'all');

  useEffect(() => {
    if (!focusRequest) return;
    const map = mapRef.current;
    const marker = markerRefs.current[focusRequest.id];
    if (!map || !marker) return;
    map.invalidateSize();
    if (!focusRequest.keepViewport) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 12), { animate: !prefersReducedMotion() });
    }
    marker.openPopup();
  }, [focusRequest]);

  // Markers only get added to the Leaflet map a render after MapContainer
  // mounts, so the remembered site's popup is reopened from its ref callback
  // (deferred a frame) instead of from a data-loaded effect.
  const registerMarker = (siteId) => (marker) => {
    if (!marker) { delete markerRefs.current[siteId]; return; }
    markerRefs.current[siteId] = marker;
    if (!restoredRef.current && siteId === initial.selectedId) {
      restoredRef.current = true;
      requestAnimationFrame(() => marker.openPopup());
    }
  };

  const showOnMap = (site) => {
    setSelectedId(site.id);
    setView('map');
    setFocusRequest({ id: site.id, keepViewport: false });
  };

  const openDevice = (event, site) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onDeviceClick) return;
    event.preventDefault();
    onDeviceClick(site.deviceId);
  };

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setProvince('');
    setType('');
    setStatus('all');
  };

  const provinceOptions = province && !provinces.includes(province) ? [province, ...provinces] : provinces;
  const typeOptions = type && !types.includes(type) ? [type, ...types] : types;
  const latestCheck = allSites.reduce((latest, s) => (s.checkedAt && (!latest || s.checkedAt > latest) ? s.checkedAt : latest), null);
  const timeLabel = loadedAt ? loadedAt.toLocaleTimeString('th-TH') : '';

  const summaryCards = [
    { key: 'all', label: 'สำนักงานทั้งหมด', count: allSites.length, symbol: '' },
    ...STATUS_FILTERS.map(key => ({ key, label: STATUS_META[key].label, count: totals[key], symbol: STATUS_META[key].symbol }))
  ];

  return (
    <motion.div
      className="list-page sites-map-page"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <header className="list-header">
        <div>
          <h1>แผนที่สำนักงาน กฟฉ.2</h1>
          <p>
            สถานะอุปกรณ์เครือข่ายที่ผูกกับแต่ละสำนักงาน (นับเฉพาะสำนักงานที่มีอุปกรณ์และ IP)
            {loadedAt && <> · โหลดล่าสุด {timeLabel} · อัปเดตทุก 1 นาที{latestCheck && <> · ตรวจวัดล่าสุด {latestCheck.toLocaleTimeString('th-TH')}</>}</>}
          </p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={reload} disabled={refreshing}>
            <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </header>

      {loading ? (
        <div className="list-panel sites-state">
          <Loader2 size={32} className="animate-spin" aria-hidden="true" />
          <p role="status">กำลังโหลดข้อมูลสำนักงาน...</p>
        </div>
      ) : error ? (
        <div className="list-error" role="alert">
          <AlertTriangle size={24} aria-hidden="true" />
          <div>
            <strong>ไม่สามารถโหลดข้อมูลสำนักงานได้</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="list-button" onClick={reload}>ลองใหม่</button>
        </div>
      ) : (
        <>
          {refreshError && (
            <div className="list-error" role="alert">
              <AlertTriangle size={24} aria-hidden="true" />
              <div>
                <strong>ข้อมูลอาจเก่า: รีเฟรชล้มเหลว</strong>
                <p>{refreshError} — แสดงข้อมูลที่โหลดสำเร็จเมื่อ {timeLabel}</p>
              </div>
              <button type="button" className="list-button" onClick={reload} disabled={refreshing}>ลองใหม่</button>
            </div>
          )}
          {incomplete && (
            <div className="list-error" role="alert">
              <AlertTriangle size={24} aria-hidden="true" />
              <div><strong>ข้อมูลอาจไม่ครบ</strong><p>ระบบต้นทางรายงานจำนวนสำนักงานมากกว่าที่โหลดมา ยอดรวมด้านล่างอาจต่ำกว่าความจริง</p></div>
            </div>
          )}

          <div className="sites-summary" role="group" aria-label="สรุปสถานะสำนักงาน (กดเพื่อกรองสถานะ)">
            {summaryCards.map(card => (
              <button
                key={card.key}
                type="button"
                className={`sites-summary-card${status === card.key || (card.key === 'all' && status === 'all') ? ' is-active' : ''}`}
                aria-pressed={status === card.key}
                onClick={() => setStatus(card.key)}
              >
                <span className="sites-summary-count">{card.count}</span>
                <span className="sites-summary-label">
                  {card.symbol && <span className={`sites-symbol sites-symbol-${card.key}`} aria-hidden="true">{card.symbol}</span>}
                  {card.label}
                </span>
              </button>
            ))}
          </div>

          <section className="list-panel sites-filters" aria-label="ตัวกรองสำนักงาน">
            <div className="list-toolbar">
              <label className={`list-field list-search${searchInput ? ' is-active' : ''}`}>
                <span>ค้นหาสำนักงาน</span>
                <div className="list-search-input">
                  <Search size={18} aria-hidden="true" />
                  <input type="search" placeholder="ชื่อสำนักงาน จังหวัด หรือประเภท" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                </div>
              </label>
              <label className={`list-field${province ? ' is-active' : ''}`}>
                <span>จังหวัด</span>
                <select value={province} onChange={e => setProvince(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {provinceOptions.map(p => <option key={p} value={p}>{provinces.includes(p) ? p : `${p} (ไม่พบในข้อมูลล่าสุด)`}</option>)}
                </select>
              </label>
              <label className={`list-field${type ? ' is-active' : ''}`}>
                <span>ประเภทสำนักงาน</span>
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {typeOptions.map(t => <option key={t} value={t}>{types.includes(t) ? t : `${t} (ไม่พบในข้อมูลล่าสุด)`}</option>)}
                </select>
              </label>
              <label className={`list-field${status !== 'all' ? ' is-active' : ''}`}>
                <span>สถานะ</span>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="all">ทั้งหมด</option>
                  {STATUS_FILTERS.map(key => <option key={key} value={key}>{STATUS_META[key].label}</option>)}
                </select>
              </label>
              <button type="button" className="list-button" onClick={clearFilters} disabled={!hasActiveFilter}>ล้างตัวกรอง</button>
            </div>
            <div className="list-result-info" role="status">
              <span>แสดง {filtered.length} จาก {allSites.length} สำนักงาน · มีพิกัด {mappable.length} · ไม่มีพิกัด {withoutCoords}</span>
            </div>
          </section>

          <div className="sites-view-toggle" role="group" aria-label="มุมมอง">
            <button type="button" className="list-button" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={18} aria-hidden="true" /> แผนที่</button>
            <button type="button" className="list-button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} aria-hidden="true" /> รายการสำนักงาน</button>
          </div>

          <div className="sites-layout" data-view={view}>
            <div ref={mapCardRef} className={`sites-map-card${isFullscreen ? ' is-fullscreen' : ''}${expanded ? ' is-expanded' : ''}`}>
              <div className="sites-map-controls">
                <button type="button" className="list-button" onClick={() => mapRef.current && fitPoints(mapRef.current, mappable.map(s => s.position), !prefersReducedMotion())} disabled={!mappable.length}>
                  <LocateFixed size={18} aria-hidden="true" /> ดูหมุดทั้งหมด
                </button>
                <button ref={fullscreenButtonRef} type="button" className="list-button" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
                  {isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'}
                </button>
              </div>
              {tileError && <div className="sites-tile-warning" role="status">โหลดภาพแผนที่พื้นหลังไม่ได้ — ยังใช้รายการสำนักงานได้ตามปกติ</div>}
              {!mappable.length && (
                <div className="sites-map-empty">
                  <MapPin size={40} aria-hidden="true" />
                  <p>{allSites.length && filtered.length ? 'สำนักงานที่ตรงตัวกรองไม่มีพิกัดที่แสดงบนแผนที่ได้' : hasActiveFilter ? 'ไม่พบสำนักงานที่ตรงกับตัวกรอง' : 'ยังไม่มีสำนักงานที่ระบุพิกัด'}</p>
                </div>
              )}
              <MapContainer
                center={initial.viewport?.center || DEFAULT_CENTER}
                zoom={initial.viewport?.zoom || DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <MapBridge mapRef={mapRef} allPoints={allPoints} hasSavedViewport={Boolean(initial.viewport)} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
                />
                {mappable.map(site => (
                  <Marker
                    key={site.id}
                    ref={registerMarker(site.id)}
                    position={site.position}
                    icon={pinIcon(site.status, site.id === activeSelectedId)}
                    title={`${site.name} — ${STATUS_META[site.status].label}`}
                    keyboard={false}
                    eventHandlers={{ click: () => setSelectedId(site.id) }}
                  >
                    <Popup maxWidth={320}>
                      <div className="sites-popup">
                        <strong>{site.name}</strong>
                        {(site.province || site.type) && <div className="sites-popup-meta">{[site.province, site.type].filter(Boolean).join(' · ')}</div>}
                        <div className="sites-popup-status"><StatusPill status={site.status} /></div>
                        {site.deviceName && <div>อุปกรณ์: {site.deviceName}</div>}
                        <div>Latency: {site.latency === null ? '—' : `${site.latency} ms`}</div>
                        {site.checkedAt && <div>ตรวจวัดล่าสุด: {site.checkedAt.toLocaleString('th-TH')}</div>}
                        <a className="sites-popup-link" href={`/device/${site.deviceId}`} onClick={(e) => openDevice(e, site)}>ดูรายละเอียดอุปกรณ์ →</a>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <section className="list-panel sites-list-panel" aria-label="รายการสำนักงาน">
              {sorted.length === 0 ? (
                <p className="sites-list-empty">{hasActiveFilter ? 'ไม่พบสำนักงานที่ตรงกับตัวกรอง' : 'ไม่มีข้อมูลสำนักงาน'}</p>
              ) : (
                <ul className="sites-list">
                  {sorted.slice(0, visibleCount).map(site => (
                    <li key={site.id} className={`sites-list-item${site.id === activeSelectedId ? ' is-selected' : ''}`}>
                      <div className="sites-list-main">
                        <strong>{site.name}</strong>
                        <span className="list-muted">{[site.province, site.type].filter(Boolean).join(' · ') || '—'}</span>
                        <StatusPill status={site.status} />
                        {!site.hasCoords && <span className="list-muted">ไม่มีพิกัดที่ใช้แสดงบนแผนที่ได้</span>}
                      </div>
                      <div className="sites-list-actions">
                        <button type="button" className="list-button" disabled={!site.hasCoords} onClick={() => showOnMap(site)} aria-label={`ดู ${site.name} บนแผนที่`}>
                          <MapPin size={16} aria-hidden="true" /> ดูบนแผนที่
                        </button>
                        <a className="list-button" href={`/device/${site.deviceId}`} onClick={(e) => openDevice(e, site)} aria-label={`ดูรายละเอียดอุปกรณ์ของ ${site.name}`}>
                          รายละเอียดอุปกรณ์
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {sorted.length > visibleCount && (
                <div className="sites-list-more">
                  <button type="button" className="list-button" onClick={() => setPageState({ key: filterKey, count: visibleCount + PAGE_SIZE })}>
                    แสดงเพิ่ม ({sorted.length - visibleCount} รายการที่เหลือ)
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default SitesMap;
