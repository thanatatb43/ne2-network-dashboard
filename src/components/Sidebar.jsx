import React, { useState, useEffect } from 'react';
import { Network, Globe, Database, Boxes, Settings, LogIn, LogOut, User as UserIcon, Info, BadgeDollarSign } from 'lucide-react';

import peaLogo from '../assets/logo/pea_logo.png';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [systemStatus, setSystemStatus] = useState({
    total: 0,
    online: 0,
    offline: 0,
    avgLatency: '0.00',
    loading: true
  });

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/status-summary`);
      const result = await response.json();

      // Expected structure: { data: { status: 'Operational', is_operational: true } }
      if (result.success && result.data) {
        setSystemStatus({
          total: result.data.total || 0,
          online: result.data.online || 0,
          offline: result.data.offline || 0,
          avgLatency: result.data.avg_latency || '0.00',
          loading: false
        });
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
      // Keep previous state but mark as not loading
      setSystemStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, []);

  const items = [
    { name: 'Network Devices', icon: Network, id: 'dashboard' },
    { name: 'ภาพรวมการใช้งบประมาณ', icon: BadgeDollarSign, id: 'budget' },
  ];

  if (user) {
    items.push({ name: 'ตรวจสอบการเชื่อมต่อ', icon: Globe, id: 'analytics' });

    // Role-based access for administrative menus
    const adminRoles = ['computer_admin', 'network_admin', 'super_admin', 'manager', 'operator'];
    if (adminRoles.includes(user.role)) {
      items.push({ name: 'การจัดการ', icon: Boxes, id: 'security' });

      // Admin Settings restricted to super_admin and manager (Operator excluded)
      if (user.role === 'super_admin' || user.role === 'manager') {
        items.push({ name: 'Admin Settings', icon: Settings, id: 'settings' });
      }
    }
  }

  // Always keep these at the bottom (All Devices above Login/About)
  items.push({ name: 'อุปกรณ์ทั้งหมด', icon: Database, id: 'devices' });

  if (!user) {
    items.push({ name: 'ลงชื่อเข้าใช้งาน', icon: LogIn, id: 'login' });
  }

  items.push({ name: 'About', icon: Info, id: 'about' });

  return (
    <div className="glass" style={{
      width: '300px',
      height: 'calc(100vh - 2rem)',
      margin: '1rem',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: '1rem',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={peaLogo} alt="PEA Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }} className="gradient-text">
          ระบบตรวจสอบ LAN Devices
        </h2>
      </div>

      <nav style={{ flex: 1 }}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (item.id === 'budget') {
                window.history.pushState({}, '', '/budget-dashboard');
              } else {
                window.history.pushState({}, '', '/');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              marginBottom: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === item.id ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
              color: activeTab === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
            }}>
            <item.icon size={20} />
            <span style={{ fontSize: '0.95rem', fontWeight: activeTab === item.id ? 600 : 400 }}>{item.name}</span>
          </div>
        ))}
      </nav>

      {user && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)'
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
              boxShadow: `0 0 15px ${user.role === 'super_admin' ? 'rgba(234, 179, 8, 0.4)' :
                user.role === 'network_admin' ? 'rgba(20, 184, 166, 0.4)' :
                  user.role === 'computer_admin' ? 'rgba(59, 130, 246, 0.4)' :
                    'rgba(168, 85, 247, 0.4)'
                }`
            }}>
              <UserIcon size={20} color="#fff" />
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
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.2
              }}>
                {user.role || 'Member'} • {user.pea_branch || 'N/A'} • {user.pea_division || 'PEA User'}
              </div>
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
            <LogOut size={14} />
            ลงชื่อออก
          </button>
        </div>
      )}

      <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>System Status</div>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: systemStatus.loading ? 'var(--text-secondary)' : systemStatus.offline > 0 ? 'var(--accent-warning)' : 'var(--accent-success)',
            boxShadow: !systemStatus.loading && systemStatus.offline === 0 ? '0 0 8px var(--accent-success)' : 'none'
          }} />
        </div>

        {systemStatus.loading ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Checking...</div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>{systemStatus.total}</span>
              <span>Total</span>
            </div>
            <div style={{ height: '15px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>{systemStatus.online}</span>
              <span>Online</span>
            </div>
            <div style={{ height: '15px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: systemStatus.offline > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)', fontWeight: 700 }}>{systemStatus.offline}</span>
              <span>Down</span>
            </div>
            <div style={{ height: '15px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{parseFloat(systemStatus.avgLatency).toFixed(1)}ms</span>
              <span>Avg Lat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { Activity } from 'lucide-react';
export default Sidebar;
