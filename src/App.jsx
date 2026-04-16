import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import StatsGrid from './components/StatsGrid';
import NetworkChart from './components/NetworkChart';
import DeviceTable from './components/DeviceTable';
import Devices from './components/Devices';
import Analytics from './components/Analytics';
import DeviceDetails from './components/DeviceDetails';
import { useNetworkData } from './hooks/useNetworkData';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { metrics, history } = useNetworkData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const handleDeviceClick = (id) => {
    setSelectedDeviceId(id);
    setActiveTab('deviceDetails');
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
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
              <DeviceTable onViewAll={() => setActiveTab('devices')} />
            </motion.div>
          ) : activeTab === 'devices' ? (
            <motion.div
              key="devices"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Devices onDeviceClick={handleDeviceClick} />
            </motion.div>
          ) : activeTab === 'deviceDetails' ? (
            <DeviceDetails 
              deviceId={selectedDeviceId} 
              onBack={() => setActiveTab('devices')} 
            />
          ) : activeTab === 'analytics' ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Analytics />
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
