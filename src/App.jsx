import React, { useState, useRef } from 'react';
import Sidebar from './components/Sidebar';
import NetworkOverview from './components/NetworkOverview';
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
import EquipmentSearch from './components/EquipmentSearch';
import JobReport from './components/JobReport';
import JobReportDetails from './components/JobReportDetails';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { APP_NAME } from './config/branding';
import ConfirmDialog from './components/equipment-form/ConfirmDialog.jsx';
import { installFormHistory, setFormHistoryOwner } from './formHistory';
import { readAuthCode, requestToken, requestUrl, isApiRequest, classify401, endSessionMessage, normalizeSession, idleRemaining, AUTH_MESSAGES } from './authSession';
import { shouldConfirmLeave, clearNavigationGuard, navigationGuardMessage, initHistoryIndex, pushHistory, replaceHistory, entryIndex, currentHistoryIndex, syncHistoryIndex, popstateDecision } from './navigationGuard';

// "ชื่อหน้า | NE2 LDAP" per tab -- detail/edit pages use their page TYPE as
// the title (not the specific record's name), which is an acceptable
// fallback per the plan rather than fetching just for the title.
const PAGE_TITLES = {
  dashboard: 'แผนที่', 'network-devices': 'ภาพรวมเครือข่าย', devices: 'อุปกรณ์เครือข่าย',
  deviceDetails: 'รายละเอียดอุปกรณ์เครือข่าย', analytics: 'ตรวจสอบการเชื่อมต่อ', settings: 'การตั้งค่าระบบ',
  'downtime-history': 'ประวัติการขัดข้อง', 'down-devices': 'อุปกรณ์ที่ขัดข้อง',
  'equipment-borrow': 'ยืมอุปกรณ์', 'equipment-loans': 'ประวัติการยืม', 'equipment-search': 'ค้นหาอุปกรณ์',
  equipmentDetails: 'รายละเอียดอุปกรณ์', equipmentEdit: 'แก้ไขอุปกรณ์',
  'report-issue': 'แจ้งปัญหา', jobDetails: 'รายละเอียดงานแจ้งปัญหา',
  budget: 'งบประมาณ', management: 'การจัดการ', about: 'เกี่ยวกับระบบและคู่มือ', login: 'เข้าสู่ระบบ',
};

// Idle session timeout: also used to detect a session that expired while the
// tab was closed (see the localStorage restore effect below).
const SESSION_TIMEOUT_MS = 1800000; // 30 minutes
const LAST_ACTIVITY_KEY = 'last_activity';
// Session metadata from login/verify (expires_at etc.), never decoded from the JWT.
const SESSION_META_KEY = 'session_meta';
const API_BASE = import.meta.env.VITE_API_BASE_URL;
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
  'equipment-search': '/equipment-search',
  'report-issue': '/report-issue',
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

  const jobMatch = pathname.match(/^\/report-issue\/([^/]+)$/);
  if (jobMatch) return { tab: 'jobDetails', jobId: jobMatch[1] };

  const equipmentEditMatch = pathname.match(/^\/equipment\/([^/]+)\/edit$/);
  if (equipmentEditMatch) return { tab: 'equipmentEdit', equipmentId: equipmentEditMatch[1] };

  const equipmentMatch = pathname.match(/^\/equipment\/([^/]+)$/);
  if (equipmentMatch) return { tab: 'equipmentDetails', equipmentId: equipmentMatch[1] };

  const budgetEntry = Object.entries(BUDGET_VIEW_PATHS).find(([, path]) => path === pathname);
  if (budgetEntry) return { tab: 'budget', budgetView: budgetEntry[0] };

  const siteMatch = pathname.match(/^\/management\/computers\/([^/]+)$/);
  if (siteMatch) return { tab: 'management', mgmtView: 'computer_management', mgmtSiteId: siteMatch[1] };

  // mgmtSiteId doubles as the item id one level inside a management view:
  // a site for computer_management, a job for job_management.
  const mgmtJobMatch = pathname.match(/^\/management\/jobs\/([^/]+)$/);
  if (mgmtJobMatch) return { tab: 'management', mgmtView: 'job_management', mgmtSiteId: mgmtJobMatch[1] };

  // Settings sub-pages: /settings/users, /settings/users/:id, /settings/locations
  const settingsMatch = pathname.match(/^\/settings\/(users|locations)(?:\/([^/]+))?$/);
  if (settingsMatch && !(settingsMatch[1] === 'locations' && settingsMatch[2])) {
    return { tab: 'settings', settingsView: settingsMatch[1], settingsItemId: settingsMatch[2] ? decodeURIComponent(settingsMatch[2]) : null };
  }

  const mgmtEntry = Object.entries(MGMT_VIEW_PATHS).find(([, path]) => path === pathname);
  if (mgmtEntry) return { tab: 'management', mgmtView: mgmtEntry[0], mgmtSiteId: null };

  const entry = Object.entries(TAB_PATHS).find(([, path]) => path === pathname);
  return entry ? { tab: entry[0] } : { tab: 'dashboard' };
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  // Hint passed from Stock Management's "add" button so the create form can
  // pre-select a site -- not part of the URL since it's just a convenience
  // default, not something a deep link needs to reproduce.
  const [newEquipmentDefaultSiteId, setNewEquipmentDefaultSiteId] = useState(null);
  // One-shot hint from a NetworkOverview stat card ("ออนไลน์") to pre-filter
  // Devices.jsx on the next mount -- Devices.jsx clears it back to null once
  // applied, so it doesn't stick around and reapply on a later, unrelated
  // visit to the same page (e.g. via the sidebar).
  const [devicesInitialStatus, setDevicesInitialStatus] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [budgetView, setBudgetView] = useState('summary');
  const [mgmtView, setMgmtView] = useState('overview');
  const [mgmtSiteId, setMgmtSiteId] = useState(null);
  const [settingsView, setSettingsView] = useState('overview');
  const [settingsItemId, setSettingsItemId] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(() => { try { return normalizeSession(JSON.parse(localStorage.getItem(SESSION_META_KEY))); } catch { return null; } });
  // The token the app is using right now -- a 401 for any other token is
  // a late answer for an older session and must not end this one.
  const tokenRef = useRef(null);
  function rememberSession(session) {
    const info = normalizeSession(session);
    setSessionInfo(info);
    try {
      if (info) localStorage.setItem(SESSION_META_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_META_KEY);
    } catch { /* display only */ }
  }
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 1024);
  // True right after navigate('jobDetails', ...) pushed a new entry on top
  // of the report-issue list (i.e. the list is genuinely the previous
  // history entry) -- lets the detail page's "back" button call
  // history.back() so a browser Back afterwards can't re-open the same
  // detail (see navigate()/popstate below for where this gets reset).
  const cameFromJobListRef = useRef(false);
  // Same idea for device details: whichever in-app page opened it (map, down
  // devices, devices, overview, management...) is the previous history entry,
  // so Back returns there instead of always jumping to the devices list.
  const cameFromDeviceSourceRef = useRef(false);
  // Unsaved-changes prompt (see navigationGuard.js): the pending action runs
  // only if the user confirms leaving.
  const [leaveConfirm, setLeaveConfirm] = useState(null);
  const lastUrlRef = useRef(window.location.pathname + window.location.search);
  const bypassPopRef = useRef(false);

  const applyRoute = (route) => {
    setActiveTab(route.tab);
    setSelectedDeviceId(route.tab === 'deviceDetails' ? route.deviceId : null);
    setSelectedEquipmentId(route.tab === 'equipmentDetails' || route.tab === 'equipmentEdit' ? route.equipmentId : null);
    setSelectedJobId(route.tab === 'jobDetails' ? route.jobId : null);
    setBudgetView(route.tab === 'budget' ? (route.budgetView || 'summary') : 'summary');
    setMgmtView(route.tab === 'management' ? (route.mgmtView || 'overview') : 'overview');
    setMgmtSiteId(route.tab === 'management' ? (route.mgmtSiteId || null) : null);
    setSettingsView(route.tab === 'settings' ? (route.settingsView || 'overview') : 'overview');
    setSettingsItemId(route.tab === 'settings' ? (route.settingsItemId || null) : null);
  };

  // Central navigation helper: updates state AND pushes a URL so the browser's
  // back/forward buttons can retrace the pages the user visited.
  const navigate = (tab, opts = {}) => {
    if (shouldConfirmLeave('navigate')) { setLeaveConfirm({ message: navigationGuardMessage(), run: () => { clearNavigationGuard(); navigate(tab, opts); } }); return; }
    let path;
    if (tab === 'deviceDetails') {
      path = `/device/${opts.deviceId}`;
    } else if (tab === 'jobDetails') {
      path = `/report-issue/${opts.jobId}`;
    } else if (tab === 'equipmentDetails') {
      path = `/equipment/${opts.equipmentId}`;
    } else if (tab === 'equipmentEdit') {
      path = `/equipment/${opts.equipmentId}/edit`;
    } else if (tab === 'budget') {
      path = BUDGET_VIEW_PATHS[opts.budgetView || 'summary'];
    } else if (tab === 'settings' && opts.settingsView && opts.settingsView !== 'overview') {
      path = `/settings/${opts.settingsView}${opts.settingsItemId ? `/${encodeURIComponent(opts.settingsItemId)}` : ''}`;
    } else if (tab === 'management') {
      const view = opts.mgmtView || 'overview';
      path = (view === 'computer_management' || view === 'job_management') && opts.mgmtSiteId
        ? `${MGMT_VIEW_PATHS[view]}/${encodeURIComponent(opts.mgmtSiteId)}`
        : MGMT_VIEW_PATHS[view];
    } else {
      path = TAB_PATHS[tab] || '/';
    }

    // Only a genuine navigate('jobDetails', ...) call -- i.e. clicking a job
    // from the list -- means the list is truly the previous history entry.
    // Any other in-app navigation invalidates that shortcut.
    cameFromJobListRef.current = tab === 'jobDetails';

    applyRoute({ tab, ...opts });
    if (window.location.pathname !== path) {
      pushHistory({}, path);
    }
    lastUrlRef.current = window.location.pathname + window.location.search;
  };

  // Same as navigate(), but takes a raw path instead of a tab name -- used
  // to restore a path stashed before sending the user to /login (see
  // POST_LOGIN_REDIRECT_KEY), since that path was captured as a plain
  // string, not a tab name.
  const navigateToPath = (path) => {
    if (shouldConfirmLeave('navigate')) { setLeaveConfirm({ message: navigationGuardMessage(), run: () => { clearNavigationGuard(); navigateToPath(path); } }); return; }
    applyRoute(pathToRoute(path));
    if (window.location.pathname !== path) {
      pushHistory({}, path);
    }
    lastUrlRef.current = window.location.pathname + window.location.search;
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
    replaceHistory({}, path);
    lastUrlRef.current = window.location.pathname + window.location.search;
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
      localStorage.removeItem(SESSION_META_KEY);
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
    const restoreCached = () => {
      if (savedUser && savedUser !== 'undefined') {
        try { setUser(JSON.parse(savedUser)); } catch (parseErr) { console.error(parseErr); }
      }
      tokenRef.current = savedToken;
      setToken(savedToken);
    };
    const verifySession = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/verify`, {
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
          rememberSession(result.session);
          tokenRef.current = savedToken;
          setToken(savedToken);
        } else if (response.status === 401) {
          // Expired / revoked / invalid / account gone -- don't let a dead
          // session masquerade as a live one, and say why.
          const code = await readAuthCode(response);
          clearStaleSession();
          setSessionInfo(null);
          if (code !== 'AUTH_TOKEN_MISSING') toast.error(endSessionMessage(code), { id: 'session-ended', duration: 8000 });
        } else {
          // 503 (auth check unavailable) or another server problem: this
          // says nothing about the token, so keep the cached session.
          restoreCached();
          toast.error(response.status === 503 ? AUTH_MESSAGES.AUTH_SERVICE_UNAVAILABLE : 'ตรวจสอบการเข้าสู่ระบบไม่ได้ในขณะนี้ ใช้ข้อมูลที่จำไว้ไปก่อน', { id: 'session-check' });
        }
      } catch (err) {
        // A network hiccup on page load shouldn't force a logout -- fall
        // back to the locally-cached session; the global 401 interceptor
        // will still catch it if the token turns out to actually be bad.
        console.error('Failed to verify session on load:', err);
        restoreCached();
      }
    };

    verifySession();
  }, []);

  // Path-based Routing: applies the URL to state on load AND on browser
  // back/forward (popstate). Does NOT call pushState here -- popstate means
  // the browser already changed the URL, we just need to follow it.
  useEffect(() => {
    // A real popstate (or the initial load) means we can no longer trust
    // that the report-issue list is "one history.back() away" -- the user
    // may have navigated anywhere. Reset the shortcut; JobReportDetails'
    // back button falls back to a normal push-navigate in that case.
    const applyPath = () => {
      cameFromJobListRef.current = false; cameFromDeviceSourceRef.current = false;
      applyRoute(pathToRoute(window.location.pathname));
      lastUrlRef.current = window.location.pathname + window.location.search;
    };
    // The one place that decides what a browser Back/Forward/history.go()
    // does. It listens in the capture phase so it runs before any page's own
    // popstate listener. With unsaved changes it stops the event (the page
    // and its form stay mounted, the route doesn't change), moves back to
    // the form's entry the same distance the other way -- Back and Forward
    // history both stay intact, even for multi-step jumps -- and asks. Only
    // "leave" repeats the user's original move to the destination they chose.
    const onPopState = (event) => {
      if (bypassPopRef.current) { bypassPopRef.current = false; syncHistoryIndex(event.state); applyPath(); return; }
      const decision = popstateDecision({ guarded: shouldConfirmLeave('popstate'), here: currentHistoryIndex(), landed: entryIndex(event.state) });
      if (decision.type !== 'follow') {
        event.stopImmediatePropagation();
        // Our own move back to the form arriving: nothing else to do.
        if (decision.type === 'ignore') return;
        const message = navigationGuardMessage();
        if (decision.type === 'fallback') {
          // Entry without a recorded position (created before this code
          // shipped): put the form's URL back on top and still ask. Forward
          // history beyond it can't be kept in this case.
          pushHistory({}, lastUrlRef.current);
          setLeaveConfirm({ message, run: () => { clearNavigationGuard(); bypassPopRef.current = true; window.history.back(); } });
          return;
        }
        const { delta } = decision;
        window.history.go(-delta);
        setLeaveConfirm({ message, run: () => { clearNavigationGuard(); bypassPopRef.current = true; window.history.go(delta); } });
        return;
      }
      syncHistoryIndex(event.state);
      applyPath();
    };

    initHistoryIndex();
    applyPath();
    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, []);

  // Text fields remember what this user typed before (see formHistory.js).
  useEffect(() => installFormHistory(), []);
  useEffect(() => { setFormHistoryOwner(user?.id ?? user?.username); }, [user]);

  // Keeps the browser tab title in sync with the current page -- index.html
  // has a static "NE2 LDAP" fallback for before this runs.
  useEffect(() => {
    document.title = PAGE_TITLES[activeTab] ? `${PAGE_TITLES[activeTab]} | ${APP_NAME}` : APP_NAME;
  }, [activeTab]);

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

  const handleAuthSuccess = (userData, userToken, provider = 'local', session = null) => {
    if (!userData || !userToken) {
      console.error('Invalid auth data received');
      return;
    }
    tokenRef.current = userToken;
    setUser(userData);
    setToken(userToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    if (session) {
      rememberSession(session);
    } else {
      // The SSO fragment carries only token/user; the expiry comes from verify.
      rememberSession(null);
      fetch(`${API_BASE}/api/auth/verify`, { headers: { Authorization: `Bearer ${userToken}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => { if (r?.session && tokenRef.current === userToken) rememberSession(r.session); })
        .catch(() => { /* expiry display only */ });
    }
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


  // The server says this session's token can't be used any more: clear it
  // locally (no logout call -- there is nothing left to revoke), explain
  // why, and bring the user back to the same page after logging in again.
  const endSession = (code) => {
    if (!tokenRef.current) return;
    clearNavigationGuard();
    setLeaveConfirm(null);
    tokenRef.current = null;
    const returnPath = `${window.location.pathname}${window.location.search}`;
    setUser(null);
    setToken(null);
    setSessionInfo(null);
    ['user', 'token', 'auth_provider', LAST_ACTIVITY_KEY, SESSION_META_KEY].forEach((k) => localStorage.removeItem(k));
    if (!returnPath.startsWith('/login') && !returnPath.startsWith('/sso-callback')) localStorage.setItem(POST_LOGIN_REDIRECT_KEY, returnPath);
    toast.error(endSessionMessage(code), { id: 'session-ended', icon: '🔒', duration: 8000, position: 'top-center' });
    navigate('login');
  };

  const handleLogout = () => {
    // Once logged out a draft can't be saved; never block the logout itself,
    // and drop any pending "leave this page?" action from the old session.
    clearNavigationGuard();
    setLeaveConfirm(null);
    const currentToken = token;
    const isSsoUser = localStorage.getItem('auth_provider') === 'sso';

    // Clear local session immediately so logout never hangs waiting on the
    // network (e.g. Wi-Fi/VPN dropped during idle timeout).
    tokenRef.current = null;
    setUser(null);
    setToken(null);
    setSessionInfo(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('auth_provider');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_META_KEY);
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
  const endSessionRef = useRef(null);
  useEffect(() => { endSessionRef.current = endSession; });

  // A locally "logged in" session doesn't guarantee the backend still
  // considers the token valid (it lives 24 h and can be revoked by logout).
  // This watches every API response app-wide: a 401 whose code says the
  // CURRENT token is dead ends the session locally. It ignores 401s for
  // requests that carried no token or an older token (a slow answer from
  // before the user logged in again) and the login/logout endpoints, and
  // never touches the session on 403 (no permission) or 503 (auth check
  // unavailable). It never calls logout: a dead token has nothing to revoke,
  // and revoking on a stale answer would end a live session.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (response.status === 401 && isApiRequest(input, API_BASE)) {
        const code = await readAuthCode(response);
        const decision = classify401({ code, requestTokenValue: requestToken(input, init), currentToken: tokenRef.current, url: requestUrl(input) });
        if (decision === 'end-session') endSessionRef.current?.(code);
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
        const check = () => {
          // Another tab may have been in use: the idle window is shared.
          const remaining = idleRemaining(localStorage.getItem(LAST_ACTIVITY_KEY), SESSION_TIMEOUT_MS);
          if (remaining > 0) { timeoutId = setTimeout(check, remaining); return; }
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
        };
        timeoutId = setTimeout(check, SESSION_TIMEOUT_MS);
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
    const downtimeOrigin = activeTab === 'downtime-history' ? `${window.location.pathname}${window.location.search}` : null;
    navigate('deviceDetails', { deviceId: id });
    if (downtimeOrigin) window.history.replaceState({ ...window.history.state, downtimeOrigin }, '', window.location.href);
    cameFromDeviceSourceRef.current = true;
  };

  // Keeps the main content area out of the Tab order (and off-limits to
  // assistive tech) while the mobile drawer covers it, so a keyboard/screen
  // reader user can't accidentally interact with page content sitting
  // behind the overlay. Never applied on desktop, where the sidebar is a
  // normal persistent panel beside the content, not an overlay.
  const mainContentRef = useRef(null);
  useEffect(() => {
    const apply = () => {
      const isMobileDrawer = isSidebarOpen && window.innerWidth <= 1024;
      if (!mainContentRef.current) return;
      if (isMobileDrawer) mainContentRef.current.setAttribute('inert', '');
      else mainContentRef.current.removeAttribute('inert');
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [isSidebarOpen]);

  return (
    <div className={`dashboard-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
      <Toaster position="top-right" reverseOrder={false} />
      <ConfirmDialog
        open={Boolean(leaveConfirm)}
        title="ออกจากหน้านี้โดยไม่บันทึก?"
        tone="danger"
        confirmLabel="ออกโดยไม่บันทึก"
        cancelLabel="อยู่ต่อเพื่อบันทึก"
        message={leaveConfirm?.message || "ข้อมูลในฟอร์มที่แก้ไขแต่ยังไม่ได้กดบันทึกจะหายไป"}
        onConfirm={() => { const run = leaveConfirm?.run; setLeaveConfirm(null); run?.(); }}
        onCancel={() => setLeaveConfirm(null)}
      />
      
      {/* Sidebar toggle -- shown whenever the sidebar is collapsed, on any screen size */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          title="แสดงเมนู"
          aria-label="แสดงเมนู"
          aria-expanded={isSidebarOpen}
          aria-controls="app-sidebar-nav"
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
        sessionInfo={sessionInfo}
        activeTab={activeTab}
        onNavigate={navigate}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="main-content" ref={mainContentRef}>
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
              <NetworkOverview
                onDeviceClick={handleDeviceClick}
                onNavigateDevices={(status) => { setDevicesInitialStatus(status); navigate('devices'); }}
                onNavigateDown={() => navigate('down-devices')}
              />
            </motion.div>
          ) : activeTab === 'devices' ? (
            <motion.div
              key="devices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Devices
                onDeviceClick={handleDeviceClick}
                user={user}
                initialStatus={devicesInitialStatus}
                onInitialStatusConsumed={() => setDevicesInitialStatus(null)}
              />
            </motion.div>
          ) : activeTab === 'deviceDetails' ? (
            <DeviceDetails
              deviceId={selectedDeviceId}
              onBack={() => {
                if (cameFromDeviceSourceRef.current || window.history.state?.downtimeOrigin?.startsWith('/downtime-history')) window.history.back();
                else navigate('devices');
              }}
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
            <AdminSettings
              token={token}
              user={user}
              view={settingsView}
              itemId={settingsItemId}
              onViewChange={(view, itemId = null) => navigate('settings', { settingsView: view, settingsItemId: itemId })}
            />
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
              onEquipmentClick={(id) => navigate('equipmentDetails', { equipmentId: id })}
            />
          ) : activeTab === 'equipment-loans' ? (
            <EquipmentLoanHistory
              token={token}
              user={user}
              onRequireLogin={() => requireLoginFor('/equipment-loans')}
            />
          ) : activeTab === 'equipment-search' ? (
            <EquipmentSearch
              token={token}
              onEquipmentClick={(id) => navigate('equipmentDetails', { equipmentId: id })}
            />
          ) : activeTab === 'report-issue' ? (
            <JobReport
              token={token}
              user={user}
              onRequireLogin={() => requireLoginFor('/report-issue')}
              onJobClick={(id) => navigate('jobDetails', { jobId: id })}
            />
          ) : activeTab === 'jobDetails' ? (
            <JobReportDetails
              jobId={selectedJobId}
              token={token}
              onBack={() => {
                // When the list is genuinely the previous history entry,
                // go back to that same entry instead of pushing a new one --
                // otherwise a browser Back afterwards would re-open this
                // same detail page. Direct links / refreshes / anywhere else
                // fall back to a normal push so "back" still always works.
                if (cameFromJobListRef.current) window.history.back();
                else navigate('report-issue');
              }}
              onEquipmentClick={(id) => navigate('equipmentDetails', { equipmentId: id })}
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
                  if (siteId != null) window.history.replaceState(window.history.state, '', `/equipment/new/edit?site_id=${encodeURIComponent(siteId)}`);
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
