import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network, Globe, Database, Boxes, Settings, LogIn, LogOut, User as UserIcon, Info, BadgeDollarSign, X,
  History, Map, ChevronDown, ChevronRight, Cpu, ShoppingCart, Search, ClipboardList, RefreshCw, AlertCircle
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

import peaLogo from '../assets/logo/pea_logo.png';
import { APP_NAME, APP_NAME_TH } from '../config/branding';
import './Sidebar.css';

const MOBILE_BREAKPOINT = 1024;
const GROUPS_STORAGE_KEY = 'sidebar:groups:v1';

// href only, for semantic navigation (middle-click/open-in-new-tab/SEO) --
// a plain left click still goes through onNavigate()/App.jsx's own router,
// which is where the real work happens. Kept local (matching this
// codebase's existing convention of duplicating small option/path lists
// per file) rather than importing across from App.jsx, to avoid a
// circular import between the two.
const ITEM_PATHS = {
  dashboard: '/', budget: '/budget-dashboard', 'network-devices': '/network-devices', devices: '/devices',
  analytics: '/analytics', 'downtime-history': '/downtime-history', 'equipment-borrow': '/equipment-borrow',
  'equipment-loans': '/equipment-loans', 'equipment-search': '/equipment-search', 'report-issue': '/report-issue',
  management: '/management', settings: '/settings', login: '/login', about: '/about',
};

// Detail/edit pages aren't menu items themselves -- highlight the closest
// related menu entry instead of leaving nothing active while viewing them.
const ACTIVE_TAB_ALIAS = {
  deviceDetails: 'devices',
  jobDetails: 'report-issue',
  equipmentDetails: 'equipment-search',
  equipmentEdit: 'equipment-search',
  'down-devices': 'network-devices',
};

const useIsMobile = (breakpoint) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
};

const readExpandedGroups = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(GROUPS_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
};
const saveExpandedGroups = (value) => {
  try { sessionStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(value)); } catch { /* Storage is optional. */ }
};

// Basic dialog accessibility for the MOBILE drawer only -- desktop is a
// plain persistent nav, not a modal, so it gets none of this. Same local
// pattern (focus trap, Escape, return focus to opener, background scroll
// lock) used for every other dialog added this session.
const useDrawerA11y = (active, containerRef, onEscape) => {
  const openerRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  useEffect(() => { onEscapeRef.current = onEscape; });
  useEffect(() => {
    if (!active) return;
    openerRef.current = document.activeElement;
    const getFocusable = () => Array.from(
      containerRef.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []
    ).filter((el) => !el.disabled);
    (getFocusable()[0] || containerRef.current)?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onEscapeRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // The captured opener is usually the App-level toggle button, but
      // that button unmounts while the drawer is open (conditionally
      // rendered only when collapsed) and remounts as a fresh DOM node once
      // it closes -- so the captured reference is stale by the time this
      // cleanup runs. Fall back to finding the (now-fresh) toggle button by
      // the aria-controls relationship it declares to this drawer.
      const opener = openerRef.current;
      // opener !== document.body: <body> trivially passes "still in the
      // document" without being a meaningful focus target -- treat it the
      // same as a stale/detached opener and use the selector fallback.
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
      else document.querySelector('[aria-controls="app-sidebar-nav"]')?.focus();
    };
    // containerRef is a ref (stable identity) -- omitted deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
};

const fmtCount = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('th-TH'));

const Sidebar = ({ activeTab, onNavigate, user, onLogout, isOpen, onClose }) => {
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const containerRef = useRef(null);
  const drawerActive = isOpen && isMobile;
  useDrawerA11y(drawerActive, containerRef, onClose);

  // Explicit user overrides for group open/closed state; a group with no
  // override defaults to open when it contains the active tab. Persisted
  // per tab (not per account) since it's just a view preference.
  const [expandedGroups, setExpandedGroups] = useState(readExpandedGroups);
  useEffect(() => { saveExpandedGroups(expandedGroups); }, [expandedGroups]);

  // "เครือข่าย" here means what /api/latency/status-summary can actually
  // measure (device reachability), not the health of the whole system --
  // see SIDEBAR_REBRANDING_PLAN.md section 7 for why this isn't called
  // "System Status" anymore. null fields (not 0) mean "no data for that
  // count yet", and are rendered as "—", never coerced to 0.
  const [networkStatus, setNetworkStatus] = useState({
    total: null, online: null, offline: null, loading: true, error: '', lastUpdated: null,
  });
  const controllerRef = useRef(null);

  const fetchNetworkStatus = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setNetworkStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/status-summary`, { signal: controller.signal });
      if (!response.ok) throw new Error('bad status');
      const result = await response.json();
      if (!result.success || !result.data) throw new Error('bad shape');
      if (controllerRef.current !== controller) return;
      const toCount = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      setNetworkStatus({
        total: toCount(result.data.total), online: toCount(result.data.online), offline: toCount(result.data.offline),
        loading: false, error: '', lastUpdated: new Date(),
      });
    } catch (err) {
      if (controllerRef.current === controller && err.name !== 'AbortError') {
        setNetworkStatus((prev) => ({ ...prev, loading: false, error: 'โหลดสถานะไม่สำเร็จ' }));
      }
    } finally {
      clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let interval = setInterval(fetchNetworkStatus, 60000);
    fetchNetworkStatus();
    // Pause polling while the tab is hidden, and catch up immediately on return.
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchNetworkStatus();
        interval = setInterval(fetchNetworkStatus, 60000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, [fetchNetworkStatus]);

  const items = [
    { type: 'item', name: 'แผนที่', icon: Map, id: 'dashboard' },
    { type: 'item', name: 'งบประมาณ', icon: BadgeDollarSign, id: 'budget' },
  ];

  // "ระบบเครือข่าย" bundles the network-related pages into one collapsible
  // group -- ตรวจสอบการเชื่อมต่อ stays login-gated like before, the rest
  // (ภาพรวมเครือข่าย/ประวัติการขัดข้อง/อุปกรณ์เครือข่าย) stay public.
  const networkChildren = [];
  if (user) {
    networkChildren.push({ name: 'ตรวจสอบการเชื่อมต่อ', icon: Globe, id: 'analytics' });
  }
  networkChildren.push({ name: 'ภาพรวมเครือข่าย', icon: Network, id: 'network-devices' });
  networkChildren.push({ name: 'ประวัติการขัดข้อง', icon: History, id: 'downtime-history' });
  networkChildren.push({ name: 'อุปกรณ์เครือข่าย', icon: Database, id: 'devices' });
  items.push({ type: 'group', name: 'ระบบเครือข่าย', icon: Network, id: 'group-network', children: networkChildren });

  // "ระบบคอมพิวเตอร์" bundles equipment borrow/return/search -- all three
  // pages are viewable without login (browsing/history/search are public),
  // the borrow/return ACTIONS within them are what actually gate on login.
  items.push({
    type: 'group', name: 'ระบบคอมพิวเตอร์', icon: Cpu, id: 'group-computer', children: [
      { name: 'ยืมอุปกรณ์', icon: ShoppingCart, id: 'equipment-borrow' },
      { name: 'ประวัติการยืม', icon: History, id: 'equipment-loans' },
      { name: 'ค้นหาอุปกรณ์', icon: Search, id: 'equipment-search' }
    ]
  });

  // "แจ้งปัญหา" is viewable without login (browsing/tracking status is
  // public), the "แจ้งปัญหาใหม่" ACTION inside it is what gates on login --
  // same convention as the equipment pages above.
  items.push({ type: 'item', name: 'แจ้งปัญหา', icon: ClipboardList, id: 'report-issue' });

  if (user) {
    // Role-based access for administrative menus
    const adminRoles = ['computer_admin', 'network_admin', 'super_admin', 'manager', 'operator'];
    if (adminRoles.includes(user.role)) {
      const managementChildren = [{ name: 'จัดการงานและอุปกรณ์', icon: Boxes, id: 'management' }];

      // Admin Settings restricted to super_admin and manager (Operator excluded)
      if (user.role === 'super_admin' || user.role === 'manager') {
        managementChildren.push({ name: 'การตั้งค่าระบบ', icon: Settings, id: 'settings' });
      }
      items.push({ type: 'group', name: 'การจัดการ', icon: Boxes, id: 'group-management', children: managementChildren });
    }
  }

  if (!user) {
    items.push({ type: 'item', name: 'ลงชื่อเข้าใช้งาน', icon: LogIn, id: 'login' });
  }

  items.push({ type: 'item', name: 'เกี่ยวกับระบบและคู่มือ', icon: Info, id: 'about' });

  const effectiveActiveTab = ACTIVE_TAB_ALIAS[activeTab] || activeTab;

  // Force the group containing the current page open whenever the route
  // actually changes -- the user can still collapse it afterward (that
  // override is respected for the rest of this visit) until the route
  // changes again.
  const lastActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (lastActiveTabRef.current === activeTab) return;
    lastActiveTabRef.current = activeTab;
    const group = items.find((i) => i.type === 'group' && i.children.some((c) => c.id === effectiveActiveTab));
    if (group) setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
    // items/effectiveActiveTab are recomputed fresh every render from props
    // already reflected by the time this fires; only activeTab should
    // trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const isGroupExpanded = (group) => {
    const hasActiveChild = group.children.some((c) => c.id === effectiveActiveTab);
    return group.id in expandedGroups ? expandedGroups[group.id] : hasActiveChild;
  };
  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({ ...prev, [group.id]: !isGroupExpanded(group) }));
  };

  // Shared left-click interception for every nav anchor -- lets
  // Ctrl/Cmd-click, middle-click and "open in new tab" work normally via
  // the real href, while a plain click goes through the app's own router.
  const go = (id) => (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(id);
    if (isMobile) onClose();
  };

  const statusDotTone = networkStatus.loading && !networkStatus.lastUpdated
    ? 'var(--text-secondary)'
    : networkStatus.error
      ? 'var(--accent-warning)'
      : networkStatus.offline ? 'var(--accent-warning)' : 'var(--accent-success)';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Overlay */}
            {isMobile && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="sidebar-overlay"
                style={{ display: 'block' }}
              />
            )}

              <Motion.div
              id="app-sidebar-nav"
              ref={containerRef}
              role={drawerActive ? 'dialog' : undefined}
              aria-modal={drawerActive ? 'true' : undefined}
              aria-label={drawerActive ? `เมนูหลัก ${APP_NAME}` : undefined}
              tabIndex={drawerActive ? -1 : undefined}
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass sidebar-container"
              style={{
                width: '300px',
                height: 'calc(100vh - 2rem)',
                margin: '1rem',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'sticky',
                top: '1rem',
                left: '0',
                zIndex: 999
              }}
            >
              <div className="sidebar-brand">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div className="sidebar-brand-logo">
                    <img src={peaLogo} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  </div>
                  <div className="sidebar-brand-copy" title={APP_NAME_TH}>
                    <h2 className="sidebar-brand-name" aria-label={`${APP_NAME}: ${APP_NAME_TH}`}>
                      {APP_NAME}
                    </h2>
                    <span className="sidebar-brand-site">กฟฉ.2</span>
                    <span className="sr-only">{APP_NAME_TH}</span>
                  </div>
                </div>

                {/* Collapse Button -- visible at any screen size, not just mobile */}
                <button
                  onClick={onClose}
                  className="sidebar-collapse-button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', display: 'flex', flexShrink: 0 }}
                  aria-label="ยุบเมนู"
                  title="ยุบเมนู"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>

              <nav aria-label="เมนูหลัก" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {items.map((item) => item.type === 'group' ? (
                  <div key={item.id} style={{ marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      className="sidebar-nav-group-button"
                      onClick={() => toggleGroup(item)}
                      aria-expanded={isGroupExpanded(item)}
                      aria-controls={`${item.id}-panel`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                      <item.icon size={20} aria-hidden="true" />
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, flex: 1, textAlign: 'left' }}>{item.name}</span>
                      {isGroupExpanded(item) ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    </button>
                    <AnimatePresence initial={false}>
                      {isGroupExpanded(item) && (
                        <Motion.div
                          id={`${item.id}-panel`}
                          className="sidebar-nav-group-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          {item.children.map((child) => {
                            const active = effectiveActiveTab === child.id;
                            return (
                              <a
                                key={child.id}
                                href={ITEM_PATHS[child.id] || '#'}
                                onClick={go(child.id)}
                                className="sidebar-nav-link"
                                aria-current={active ? 'page' : undefined}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  padding: '0.75rem 1rem 0.75rem 2.25rem',
                                  borderRadius: '0.75rem',
                                  marginBottom: '0.25rem',
                                  background: active ? 'var(--sidebar-item-active)' : 'transparent',
                                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
                                }}>
                                <child.icon size={17} aria-hidden="true" />
                                <span style={{ fontSize: '0.9rem', fontWeight: active ? 600 : 400 }}>{child.name}</span>
                              </a>
                            );
                          })}
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <a
                    key={item.id}
                    href={ITEM_PATHS[item.id] || '#'}
                    onClick={go(item.id)}
                    className="sidebar-nav-link"
                    aria-current={effectiveActiveTab === item.id ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '0.75rem',
                      marginBottom: '0.5rem',
                      background: effectiveActiveTab === item.id ? 'var(--sidebar-item-active)' : 'transparent',
                      color: effectiveActiveTab === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}>
                    <item.icon size={20} aria-hidden="true" />
                    <span style={{ fontSize: '0.95rem', fontWeight: effectiveActiveTab === item.id ? 600 : 400 }}>{item.name}</span>
                  </a>
                ))}
              </nav>

              {user && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'var(--glass-bg-subtle)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: user.role === 'super_admin' ? 'var(--accent-secondary)' :
                        user.role === 'network_admin' ? '#14b8a6' :
                          user.role === 'computer_admin' ? '#3b82f6' :
                            'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 0 15px ${user.role === 'super_admin' ? 'rgba(234, 179, 8, 0.4)' :
                        user.role === 'network_admin' ? 'rgba(20, 184, 166, 0.4)' :
                          user.role === 'computer_admin' ? 'rgba(59, 130, 246, 0.4)' :
                            'rgba(168, 85, 247, 0.4)'
                        }`
                    }}>
                      <UserIcon size={20} color="#fff" aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--accent-primary)',
                        fontWeight: 500,
                        marginBottom: '0.1rem'
                      }}>
                        @{user.username}
                      </div>
                      {(user.position || user.pea_division) && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {[user.position, user.pea_division].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      color: 'var(--accent-danger)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    className="logout-button-hover"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    ลงชื่อออก
                  </button>
                </div>
              )}

              <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>สถานะเครือข่าย</div>
                  <div
                    role="status"
                    title={networkStatus.error ? networkStatus.error : networkStatus.loading && !networkStatus.lastUpdated ? 'กำลังตรวจสอบ' : undefined}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: statusDotTone,
                      boxShadow: !networkStatus.loading && !networkStatus.error && !networkStatus.offline ? '0 0 8px var(--accent-success)' : 'none'
                    }} />
                </div>

                {networkStatus.loading && !networkStatus.lastUpdated ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>กำลังตรวจสอบ…</div>
                ) : networkStatus.error && !networkStatus.lastUpdated ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertCircle size={12} aria-hidden="true" /> โหลดสถานะไม่ได้
                    </span>
                    <button
                      type="button"
                      onClick={fetchNetworkStatus}
                      aria-label="ลองโหลดสถานะเครือข่ายใหม่"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}
                    >
                      <RefreshCw size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmtCount(networkStatus.total)}</span>
                        <span>ทั้งหมด</span>
                      </div>
                      <div style={{ height: '15px', width: '1px', background: 'var(--border-subtle)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{fmtCount(networkStatus.online)}</span>
                        <span>ออนไลน์</span>
                      </div>
                      <div style={{ height: '15px', width: '1px', background: 'var(--border-subtle)' }} />
                      <a
                        href="/down-devices"
                        onClick={go('down-devices')}
                        className="sidebar-status-link"
                        style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none' }}
                        title="ดูรายการอุปกรณ์ที่ขัดข้อง"
                      >
                        <span style={{ color: networkStatus.offline ? 'var(--accent-danger)' : 'var(--text-secondary)', fontWeight: 700 }}>{fmtCount(networkStatus.offline)}</span>
                        <span>ขัดข้อง</span>
                      </a>
                    </div>
                    {networkStatus.error && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--accent-warning)', marginTop: '0.4rem' }}>ข้อมูลจากครั้งก่อน รีเฟรชล่าสุดไม่สำเร็จ</div>
                    )}
                  </>
                )}
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
