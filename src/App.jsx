import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import StatsGrid from './components/StatsGrid';
import NetworkChart from './components/NetworkChart';
import DeviceTable from './components/DeviceTable';
import Devices from './components/Devices';
import Analytics from './components/Analytics';
import DeviceDetails from './components/DeviceDetails';
import AdminSettings from './components/AdminSettings';
import Management from './components/Management';
import About from './components/About';
import Auth from './components/Auth';
import BudgetDashboard from './components/BudgetDashboard';
import { useNetworkData } from './hooks/useNetworkData';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

function App() {
  const { metrics, history } = useNetworkData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedUser !== 'undefined') {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse user session:', err);
        localStorage.removeItem('user');
      }
    }
    
    if (savedToken && savedToken !== 'undefined') {
      setToken(savedToken);
    }
  }, []);

  // Simple Path-based Routing
  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      if (path === '/budget-dashboard') {
        setActiveTab('budget');
      }
    };

    checkPath();
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
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

  const handleAuthSuccess = (userData, userToken) => {
    if (!userData || !userToken) {
      console.error('Invalid auth data received');
      return;
    }
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`, { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('session_id');
    sessionStorage.removeItem('view_tracked');
    setActiveTab('login');
  };

  const handleDeviceClick = (id) => {
    setSelectedDeviceId(id);
    setActiveTab('deviceDetails');
  };

  return (
    <div className={`dashboard-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Mobile Menu Button */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
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
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>ระบบตรวจสอบสถานะอุปกรณ์เครือข่ายภายในสำนักงาน กฟฉ.2</h1>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>แผนกคอมพิวเตอร์และเครือข่าย กดส.ฉ.2</p>
                </div>
                <div className="glass" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Live Feed</span>
                </div>
              </header>

              <StatsGrid metrics={metrics} />
              <NetworkChart history={history} />
              <DeviceTable onViewAll={() => setActiveTab('devices')} user={user} />
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
              onBack={() => setActiveTab('devices')} 
              user={user}
              token={token}
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
          ) : activeTab === 'about' ? (
            <About />
          ) : activeTab === 'login' ? (
            <Auth onAuthSuccess={handleAuthSuccess} />
          ) : activeTab === 'security' ? (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Management user={user} token={token} />
            </motion.div>
          ) : activeTab === 'budget' ? (
            <motion.div
              key="budget"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <BudgetDashboard token={token} />
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
                  onClick={() => setActiveTab('dashboard')}
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
