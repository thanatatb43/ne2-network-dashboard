import React from 'react';
import { Home, Layout, Database, Shield, Settings, Menu } from 'lucide-react';

import peaLogo from '../assets/logo/pea_logo.png';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const items = [
    { name: 'Dashboard', icon: Home, id: 'dashboard' },
    { name: 'Network Devices', icon: Database, id: 'devices' },
    { name: 'Analytics', icon: Layout, id: 'analytics' },
    { name: 'Security', icon: Shield, id: 'security' },
    { name: 'Settings', icon: Settings, id: 'settings' },
  ];

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
          ระบบตรวจสอบสถานะ Network Devices (LAN)
        </h2>
      </div>

      <nav style={{ flex: 1 }}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveTab(item.id)}
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

      <div style={{ marginTop: 'auto', padding: '1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>System Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Operational</span>
        </div>
      </div>
    </div>
  );
};

import { Activity } from 'lucide-react';
export default Sidebar;
