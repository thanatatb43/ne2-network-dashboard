import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import StatsGrid from './components/StatsGrid';
import NetworkChart from './components/NetworkChart';
import DeviceTable from './components/DeviceTable';
import Devices from './components/Devices';
import Analytics from './components/Analytics';
import DeviceDetails from './components/DeviceDetails';
import EquipmentDetails from './components/EquipmentDetails';
import EquipmentEdit from './components/EquipmentEdit';
import SitesMap from './components/SitesMap';
import AdminSettings from './components/AdminSettings';
import Management from './components/Management';
import About from './components/About';
import Auth from './components/Auth';
import SsoCallback from './components/SsoCallback';
import BudgetDashboard from './components/BudgetDashboard';
import DowntimeHistory from './components/DowntimeHistory';
import DownDevices from './components/DownDevices';
import EquipmentBorrow from './components/EquipmentBorrow';
import EquipmentLoanHistory from './components/EquipmentLoanHistory';
import { useNetworkData } from './hooks/useNetworkData';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

// Idle session timeout: also used to detect a session that expired while the
// tab was closed (see the localStorage restore effect below).
const SESSION_TIMEOUT_MS = 1800000; // 30 minutes
const LAST_ACTIVITY_KEY = 'last_activity';
// Where to send the user after a successful login, when they were sent to
// /login mid-task (e.g. clicking "edit" while logged out). Stored in
// localStorage rather than React state because the SSO flow does a full
// page navigation away to the SSO provider and back, which wipes any
// in-memory state.
const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect';

// Maps each top-level tab to a URL path, so the browser back/forward buttons
// can move between pages the user has actually visited.
const TAB_PATHS = {
  dashboard: '/',
  'network-devices': '/network-devices',
  devices: '/devices',
  analytics: '/analytics',
  settings: '/settings',
  'downtime-history': '/downtime-history',
  'down-devices': '/down-devices',
  'equipment-borrow': '/equipment-borrow',
  'equipment-loans': '/equipment-loans',
  about: '/about',
  login: '/login',
  'sso-callback': '/sso-callback'
};

// Sub-views inside the Budget Dashboard page.
const BUDGET_VIEW_PATHS = {
  summary: '/budget-dashboard',
  search: '/budget-dashboard/search'
};

// Sub-views inside the Management page (and the site drill-down one level
// further inside "computer_management").
const MGMT_VIEW_PATHS = {
  overview: '/management',
  network: '/management/network',
  network_history: '/management/network/history',
  network_devices: '/management/network/devices',
  budget_management: '/management/budget',
  job_management: '/management/jobs',
  computer_management: '/management/computers',
  stock_management: '/management/stock'
};

const pathToRoute = (pathname) => {
  const deviceMatch = pathname.match(/^\/device\/([^/]+)$/);
  if (deviceMatch) return { tab: 'deviceDetails', deviceId: deviceMatch[1] };

  const equipmentEditMatch = pathname.match(/^\/equipment\/([^/]+)\/edit$/);
  if (equipmentEditMatch) return { tab: 'equipmentEdit', equipmentId: equipmentEditMatch[1] };

  const equipmentMatch = pathname.match(/^\/equipment\/([^/]+)$/);
  if (equipmentMatch) return { tab: 'equipmentDetails', equipmentId: equipmentMatch[1] };

  const budgetEntry = Object.entries(BUDGET_VIEW_PATHS).find(([, path]) => path === pathname);
  if (budgetEntry) return { tab: 'budget', budgetView: budgetEntry[0] };

  const siteMatch = pathname.match(/^\/management\/computers\/([^/]+)$/);
  if (siteMatch) return { tab: 'management', mgmtView: 'computer_management', mgmtSiteId: siteMatch[1] };

  const mgmtEntry = Object.entries(MGMT_VIEW_PATHS).find(([, path]) => path === pathname);
  if (mgmtEntry) return { tab: 'management', mgmtView: mgmtEntry[0], mgmtSiteId: null };

  const entry = Object.entries(TAB_PATHS).find(([, path]) => path === pathname);
  return entry ? { tab: entry[0] } : { tab: 'dashboard' };
};

function App() {
  const { metrics, history } = useNetworkData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  // Hint passed from Stock Management's "add" button so the create form can
  // pre-select a site -- not part of the URL since it's just a convenience
  // default, not something a deep link needs to reproduce.
  const [newEquipmentDefaultSiteId, setNewEquipmentDefaultSiteId] = useState(null);
  const [budgetView, setBudgetView] = useState('summary');
  const [mgmtView, setMgmtView] = useState('overview');
  const [mgmtSiteId, setMgmtSiteId] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const applyRoute = (route) => {
    setActiveTab(route.tab);
    setSelectedDeviceId(route.tab === 'deviceDetails' ? route.deviceId : null);
    setSelectedEquipmentId(route.tab === 'equipmentDetails' || route.tab === 'equipmentEdit' ? route.equipmentId : null);
    setBudgetView(route.tab === 'budget' ? (route.budgetView || 'summary') : 'summary');
    setMgmtView(route.tab === 'management' ? (route.mgmtView || 'overview') : 'overview');
    setMgmtSiteId(route.tab === 'management' ? (route.mgmtSiteId || null) : null);
  };

  // Central navigation helper: updates state AND pushes a URL so the browser's
  // back/forward buttons can retrace the pages the user visited.
  const navigate = (tab, opts = {}) => {
    let path;
    if (tab === 'deviceDetails') {
      path = `/device/${opts.deviceId}`;
    } else if (tab === 'equipmentDetails') {
      path = `/equipment/${opts.equipmentId}`;
    } else if (tab === 'equipmentEdit') {
      path = `/equipment/${opts.equipmentId}/edit`;
    } else if (tab === 'budget') {
      path = BUDGET_VIEW_PATHS[opts.budgetView || 'summary'];
    } else if (tab === 'management') {
      const view = opts.mgmtView || 'overview';
      path = view === 'computer_management' && opts.mgmtSiteId
        ? `${MGMT_VIEW_PATHS.computer_management}/${opts.mgmtSiteId}`
        : MGMT_VIEW_PATHS[view];
    } else {
      path = TAB_PATHS[tab] || '/';
    }

    applyRoute({ tab, ...opts });
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  // Same as navigate(), but takes a raw path instead of a tab name -- used
  // to restore a path stashed before sending the user to /login (see
  // POST_LOGIN_REDIRECT_KEY), since that path was captured as a plain
  // string, not a tab name.
  const navigateToPath = (path) => {
    applyRoute(pathToRoute(path));
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  };

  // Swaps the current history entry for a new tab/path instead of pushing a
  // new one -- used when a page is "consumed" by an action (e.g. a save)
  // and shouldn't reappear if the user hits back afterwards. Without this,
  // saving equipment edits then clicking back lands right back on the edit
  // form instead of skipping past it to whatever came before.
  const navigateReplace = (tab, opts = {}) => {
    let path;
    if (tab === 'equipmentDetails') {
      path = `/equipment/${opts.equipmentId}`;
    } else if (tab === 'equipmentEdit') {
      path = `/equipment/${opts.equipmentId}/edit`;
    } else {
      path = TAB_PATHS[tab] || '/';
    }
    applyRoute({ tab, ...opts });
    window.history.replaceState({}, '', path);
  };

  // Called by BudgetDashboard/Management when the user switches sub-view
  // WITHOUT leaving the page (e.g. clicking "search" or a site card).
  const navigateBudgetView = (view) => navigate('budget', { budgetView: view });
  const navigateMgmtView = (view, siteId = null) => navigate('management', { mgmtView: view, mgmtSiteId: siteId });

  // Generic login gate for actions that need auth but don't change route on
  // their own (e.g. borrow/return, which just opens a modal on whatever
  // page the user is already on) -- stashes that page so login returns
  // there instead of always landing on the dashboard.
  const requireLoginFor = (returnPath) => {
    toast.error('กรุณาเข้าสู่ระบบก่อนดำเนินการนี้');
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, returnPath);
    navigate('login');
  };

  // Auto-open on desktop / auto-close on mobile, but ONLY when actually
  // crossing the breakpoint -- otherwise resizing a desktop window (e.g.
  // un-maximizing it slightly) would keep forcing back open a sidebar the
  // user deliberately collapsed with the new toggle button.
  useEffect(() => {
    let wasDesktop = window.innerWidth > 1024;
    setIsSidebarOpen(wasDesktop);

    const handleResize = () => {
      const isDesktop = window.innerWidth > 1024;
      if (isDesktop !== wasDesktop) {
        wasDesktop = isDesktop;
        setIsSidebarOpen(isDesktop);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    const clearStaleSession = () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('auth_provider');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    };

    // The 30-minute idle timer below only runs in-memory, so closing the tab
    // kills it without ever logging the user out. localStorage persists across
    // tab closes though, so without this check a session past its idle limit
    // would silently come back to life just by reopening the tab. Checked
    // locally first (no network needed) before the server-side verify below.
    const isExpired = lastActivity && (Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS);

    if (isExpired) {
      clearStaleSession();
      return;
    }

    if (!savedToken || savedToken === 'undefined') {
      return;
    }

    // A token sitting in localStorage isn't proof it's still valid --
    // it may have expired or been revoked server-side while the tab was
    // closed. Verify it with the backend before restoring the session, so a
    // dead token never comes back looking logged in (this also refreshes
    // role/pea_branch/position from the DB instead of whatever was baked
    // into the JWT at login time).
    const verifySession = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (response.ok) {
          const result = await response.json();
          const freshUser = result.user || result.data?.user || (result.username ? result : result.data);
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          } else if (savedUser && savedUser !== 'undefined') {
            try { setUser(JSON.parse(savedUser)); } catch (parseErr) { console.error(parseErr); }
          }
          setToken(savedToken);
        } else {
          // 401: expired / missing / forged / blacklisted token -- don't
          // let a dead session masquerade as a live one.
          clearStaleSession();
        }
      } catch (err) {
        // A network hiccup on page load shouldn't force a logout -- fall
        // back to the locally-cached session; the global 401 interceptor
        // will still catch it if the token turns out to actually be bad.
        console.error('Failed to verify session on load:', err);
        if (savedUser && savedUser !== 'undefined') {
          try { setUser(JSON.parse(savedUser)); } catch (parseErr) { console.error(parseErr); }
        }
        setToken(savedToken);
      }
    };

    verifySession();
  }, []);

  // Path-based Routing: applies the URL to state on load AND on browser
  // back/forward (popstate). Does NOT call pushState here -- popstate means
  // the browser already changed the URL, we just need to follow it.
  useEffect(() => {
    const applyPath = () => applyRoute(pathToRoute(window.location.pathname));

    applyPath();
    window.addEventListener('popstate', applyPath);
    return () => window.removeEventListener('popstate', applyPath);
  }, []);

  // Site Statistics Tracking
  useEffect(() => {
    // 1. Initialize Session
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      // Fallback for insecure contexts (HTTP) where crypto.randomUUID is unavailable
      if (window.crypto?.randomUUID) {
        sessionId = crypto.randomUUID();
      } else {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      }
      sessionStorage.setItem('session_id', sessionId);
    }

    // 2. Track Visit/Heartbeat Logic
    const trackEvent = async () => {
      const hasBeenTracked = sessionStorage.getItem('view_tracked');
      
      // Determine if this is a new visit or just maintaining the online status
      const eventType = !hasBeenTracked ? 'visit' : 'ping';
      
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stats/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: eventType,
            session_token: sessionId,
            user_id: user?.id || null,
            path: activeTab,
            is_new_view: eventType === 'visit',
            timestamp: new Date().toISOString()
          })
        });
        
        // Mark as tracked ONLY after a successful 'visit' event
        if (eventType === 'visit') {
          sessionStorage.setItem('view_tracked', 'true');
        }
      } catch (err) {
        console.error('Stats tracking failed:', err);
      }
    };

    // Trigger tracking on mount
    trackEvent();

    // 3. Heartbeat (Every 3 minutes)
    const heartbeat = setInterval(() => {
      trackEvent();
    }, 3 * 60 * 1000);

    return () => clearInterval(heartbeat);
  }, [user]); // Re-sync tracking if user logs in/out

  // Idle/Visibility Warning
  useEffect(() => {
    let lastHiddenTime = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        // Only show if they were away for more than 30 minutes (1800000ms) to avoid spamming
        // Or if it's the first time they come back
        const timeAway = Date.now() - lastHiddenTime;
        if (lastHiddenTime > 0 && timeAway > 1800000) {
          toast('หากพบอาการกระตุก หรือ ดีเลย์ กรุณา ปิดโปรแกรม(Tab) และเข้าใหม่อีกครั้ง', {
            icon: '⚠️',
            duration: 6000,
            position: 'top-center',
            style: {
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent-warning)',
              fontSize: '1rem',
              fontWeight: 500,
              fontFamily: '"Krub", sans-serif',
              marginTop: '15vh',
              padding: '1rem 2rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            },
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleAuthSuccess = (userData, userToken, provider = 'local') => {
    if (!userData || !userToken) {
      console.error('Invalid auth data received');
      return;
    }
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    // Remembered so handleLogout knows whether it also needs to clear the
    // Keycloak/PEA SSO session, not just our own JWT.
    localStorage.setItem('auth_provider', provider);

    // If the user was sent to /login mid-task (e.g. clicking "edit" while
    // logged out), send them back to that exact page instead of always
    // landing on the dashboard.
    const redirectPath = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (redirectPath) {
      localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      navigateToPath(redirectPath);
    } else {
      navigate('dashboard');
    }
  };

  const handleLogout = () => {
    const currentToken = token;
    const isSsoUser = localStorage.getItem('auth_provider') === 'sso';

    // Clear local session immediately so logout never hangs waiting on the
    // network (e.g. Wi-Fi/VPN dropped during idle timeout).
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('auth_provider');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem('session_id');
    sessionStorage.removeItem('view_tracked');

    if (isSsoUser) {
      // SSO users also have a Keycloak session/cookie that our own JWT
      // blacklist doesn't touch. Blacklist the JWT first, then do a full
      // page redirect (not fetch) to the SSO logout endpoint so the browser
      // actually navigates there and Keycloak's cookies get cleared.
      const redirectToSsoLogout = () => {
        window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/auth/sso/logout`;
      };

      if (currentToken) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentToken}` },
          signal: controller.signal
        })
          .catch(err => console.error('Logout error:', err))
          .finally(() => {
            clearTimeout(timeoutId);
            redirectToSsoLogout();
          });
      } else {
        redirectToSsoLogout();
      }
      return;
    }

    navigate('login');

    // Best-effort notify the backend; failures/hangs no longer block logout.
    if (currentToken) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      }).catch(err => console.error('Logout error:', err));
    }
  };

  // Kept fresh every render so the fetch interceptor below (installed once
  // on mount) always calls the CURRENT handleLogout/user, not a stale
  // closure from whenever the effect first ran.
  const handleLogoutRef = React.useRef(handleLogout);
  handleLogoutRef.current = handleLogout;
  const userRef = React.useRef(user);
  userRef.current = user;

  // A locally "logged in" session doesn't guarantee the backend still
  // considers the token valid -- e.g. a tab left open past the token's
  // server-side expiry, or a token that was revoked. Previously this only
  // surfaced as a raw "Invalid or expired token" error the moment someone
  // tried to add/edit something, while the UI still looked fully logged in.
  // This intercepts every fetch() call app-wide (no per-component changes
  // needed) and force-logs-out the instant ANY authenticated request comes
  // back 401, so a dead session never keeps masquerading as a live one.
  useEffect(() => {
    const isHandlingExpiryRef = { current: false };
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const options = args[1];
        const headers = options?.headers;
        const hasAuthHeader = !!headers && (
          (typeof headers.get === 'function' && headers.get('Authorization')) ||
          headers['Authorization']
        );
        if (hasAuthHeader && userRef.current && !isHandlingExpiryRef.current) {
          isHandlingExpiryRef.current = true;
          toast.error('เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง', {
            icon: '🔒',
            duration: 6000,
            position: 'top-center',
            style: {
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent-warning)',
              fontSize: '1rem',
              fontWeight: 500,
              fontFamily: '"Krub", sans-serif'
            }
          });
          handleLogoutRef.current();
          setTimeout(() => { isHandlingExpiryRef.current = false; }, 3000);
        }
      }
      return response;
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  // Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    let timeoutId;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // Only set the timeout if a user is currently logged in
      if (user) {
        // Stamp last-activity so a closed-then-reopened tab can tell whether
        // the 30-minute idle window already elapsed (see restore effect above).
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        timeoutId = setTimeout(() => {
          handleLogout();
          toast('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้งเนื่องจากไม่มีการใช้งาน', {
            icon: '🔒',
            duration: 8000,
            position: 'top-center',
            style: {
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent-warning)',
              fontSize: '1rem',
              fontWeight: 500,
              fontFamily: '"Krub", sans-serif'
            }
          });
        }, SESSION_TIMEOUT_MS);
      }
    };

    // Set initial timeout
    resetTimeout();

    // Listeners for user activity
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimeout);
    });

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimeout);
      });
    };
  }, [user]); // Re-run effect when user logs in or out


  const handleDeviceClick = (id) => {
    navigate('deviceDetails', { deviceId: id });
  };

  return (
    <div className={`dashboard-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Sidebar toggle -- shown whenever the sidebar is collapsed, on any screen size */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          title="แสดงเมนู"
          className="glass"
          style={{
            position: 'fixed',
            top: '1.5rem',
            left: '1.5rem',
            zIndex: 100,
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
          }}
        >
          <div style={{ width: '20px', height: '2px', background: '#fff', marginBottom: '4px', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#fff', marginBottom: '4px', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#fff', borderRadius: '2px' }} />
        </button>
      )}

      <Sidebar
        activeTab={activeTab}
        onNavigate={navigate}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <SitesMap onDeviceClick={handleDeviceClick} />
          ) : activeTab === 'network-devices' ? (
            <motion.div
              key="network-devices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <header className="dashboard-header-title-wrap" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <h1 className="dashboard-header-title" style={{ margin: 0, fontWeight: 700 }}>ระบบตรวจสอบสถานะอุปกรณ์เครือข่ายภายในสำนักงาน กฟฉ.2</h1>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>แผนกคอมพิวเตอร์และเครือข่าย กดส.ฉ.2</p>
                </div>
                <div className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Live Feed</span>
                </div>
              </header>

              <StatsGrid metrics={metrics} onCardClick={() => navigate('devices')} />
              <NetworkChart history={history} />
              <DeviceTable onViewAll={() => navigate('devices')} onDeviceClick={handleDeviceClick} user={user} />
            </motion.div>
          ) : activeTab === 'devices' ? (
            <motion.div
              key="devices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Devices onDeviceClick={handleDeviceClick} user={user} />
            </motion.div>
          ) : activeTab === 'deviceDetails' ? (
            <DeviceDetails
              deviceId={selectedDeviceId}
              onBack={() => navigate('devices')}
              onManageSiteEquipment={(siteId) => navigate('management', { mgmtView: 'computer_management', mgmtSiteId: siteId })}
              user={user}
              token={token}
            />
          ) : activeTab === 'equipmentDetails' ? (
            <EquipmentDetails
              equipmentId={selectedEquipmentId}
              // Equipment detail can be reached from multiple lists (Stock
              // Management today, possibly others later) or a raw QR-code
              // link, so there's no single fixed "back" destination -- reuse
              // the browser's own history instead, same as the back/forward
              // button already does for the rest of the app.
              onBack={() => window.history.back()}
              user={user}
              token={token}
              onRequireLogin={() => requireLoginFor(`/equipment/${selectedEquipmentId}`)}
              onEditClick={(equipmentItem) => {
                if (!user) {
                  toast.error('กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูลอุปกรณ์');
                  localStorage.setItem(POST_LOGIN_REDIRECT_KEY, `/equipment/${equipmentItem.id}/edit`);
                  navigate('login');
                  return;
                }
                // Replaces (not pushes) so the view/edit pair collapses into
                // a single back-stop -- otherwise going back after a save
                // would land on this same view page again instead of
                // skipping straight past it to wherever the user came from.
                navigateReplace('equipmentEdit', { equipmentId: equipmentItem.id });
              }}
            />
          ) : activeTab === 'equipmentEdit' ? (
            <EquipmentEdit
              equipmentId={selectedEquipmentId}
              token={token}
              user={user}
              defaultSiteId={newEquipmentDefaultSiteId}
              onBack={() => window.history.back()}
              onSaved={() => navigateReplace('equipmentDetails', { equipmentId: selectedEquipmentId })}
              onCreated={(newId) => {
                setNewEquipmentDefaultSiteId(null);
                // Replace, not push -- the blank "new" form was just
                // consumed by creating the record, so going back from here
                // shouldn't return to that now-submitted blank form.
                navigateReplace('equipmentEdit', { equipmentId: newId });
              }}
            />
          ) : activeTab === 'analytics' ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Analytics user={user} token={token} />
            </motion.div>
          ) : activeTab === 'settings' ? (
            <AdminSettings token={token} user={user} />
          ) : activeTab === 'downtime-history' ? (
            <motion.div
              key="downtime-history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DowntimeHistory token={token} onDeviceClick={handleDeviceClick} />
            </motion.div>
          ) : activeTab === 'down-devices' ? (
            <motion.div
              key="down-devices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DownDevices onDeviceClick={handleDeviceClick} />
            </motion.div>
          ) : activeTab === 'equipment-borrow' ? (
            <EquipmentBorrow
              token={token}
              user={user}
              onRequireLogin={() => requireLoginFor('/equipment-borrow')}
            />
          ) : activeTab === 'equipment-loans' ? (
            <EquipmentLoanHistory
              token={token}
              user={user}
              onRequireLogin={() => requireLoginFor('/equipment-loans')}
            />
          ) : activeTab === 'about' ? (
            <About />
          ) : activeTab === 'login' ? (
            <Auth onAuthSuccess={handleAuthSuccess} />
          ) : activeTab === 'sso-callback' ? (
            <SsoCallback onAuthSuccess={handleAuthSuccess} onBackToLogin={() => navigate('login')} />
          ) : activeTab === 'management' ? (
            <motion.div
              key="management"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Management
                user={user}
                token={token}
                onDeviceClick={handleDeviceClick}
                onEquipmentClick={(id) => navigate('equipmentDetails', { equipmentId: id })}
                onAddStock={(siteId) => {
                  setNewEquipmentDefaultSiteId(siteId);
                  navigate('equipmentEdit', { equipmentId: 'new' });
                }}
                onRequireLogin={() => requireLoginFor('/management/stock')}
                view={mgmtView}
                siteId={mgmtSiteId}
                onViewChange={navigateMgmtView}
              />
            </motion.div>
          ) : activeTab === 'budget' ? (
            <motion.div
              key="budget"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <BudgetDashboard token={token} view={budgetView} onViewChange={navigateBudgetView} />
            </motion.div>
          ) : (
            <motion.div
              key="other"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}
            >
              <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
                <h2 style={{ margin: 0 }}>This page is under development</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Please check back later.</p>
                <button
                  onClick={() => navigate('dashboard')}
                  className="glass" 
                  style={{ marginTop: '1rem', padding: '0.5rem 2rem', cursor: 'pointer', color: 'var(--accent-primary)' }}
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
