import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Share2, Globe, Shield, Cpu, Users, ArrowRight, Loader2, Search, RefreshCw } from 'lucide-react';

const DeviceDetails = ({ deviceId, onBack }) => {
  const [deviceData, setDeviceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, completed
  const [scannedClients, setScannedClients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchResults = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/clients/device/${deviceId}`);
      const result = await response.json();
      if (result.success) {
        setScannedClients(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching client results:', error);
    }
  };

  useEffect(() => {
    const fetchDeviceDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/${deviceId}`);
        const result = await response.json();
        setDeviceData(result.data);

        const clientsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/clients/device/${deviceId}`);
        const clientsResult = await clientsRes.json();
        if (clientsResult.success && clientsResult.data?.length > 0) {
          setScannedClients(clientsResult.data);
          setScanStatus('completed');
        } else {
          setScannedClients([]);
          setScanStatus('idle');
        }
      } catch (error) {
        console.error('Error fetching device details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (deviceId) {
      fetchDeviceDetails();
    }
  }, [deviceId]);

  const startScan = async () => {
    setScanStatus('scanning');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/clients/scan/${deviceId}`, {
        method: 'POST'
      });
      const result = await response.json();

      if (result.success) {
        setTimeout(async () => {
          await fetchResults();
          setScanStatus('completed');
        }, 3000);
      } else {
        setScanStatus('idle');
        alert('Scan failed: ' + result.message);
      }
    } catch (error) {
      console.error('Scan error:', error);
      setScanStatus('idle');
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = scannedClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(scannedClients.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={40} color="var(--accent-primary)" />
        <p style={{ color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูลอุปกรณ์...</p>
      </div>
    );
  }

  if (!deviceData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Device not found</h2>
        <button onClick={onBack} className="glass" style={{ marginTop: '1rem', padding: '0.5rem 2rem' }}>Go Back</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="device-details"
    >
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onBack}
            className="glass"
            style={{
              padding: '0.75rem',
              borderRadius: '50%',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>{deviceData.pea_name}</h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>Network Segment Explorer & Live Scan</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={fetchResults}
            className="glass"
            style={{ padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}
            title="Refresh results"
          >
            <RefreshCw size={18} className={scanStatus === 'scanning' ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={startScan}
            disabled={scanStatus === 'scanning'}
            className="glass"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, var(--accent-primary), #818cf8)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: scanStatus === 'scanning' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(56, 189, 248, 0.3)',
              opacity: scanStatus === 'scanning' ? 0.7 : 1
            }}
          >
            <Share2 size={18} />
            {scanStatus === 'scanning' ? 'Scanning...' : scanStatus === 'completed' ? 'Scan Again' : 'Live Scan Now'}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {scanStatus === 'scanning' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card glass"
            style={{ marginBottom: '2.5rem', border: '1px solid var(--accent-primary)', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="pulse-animation" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0 }}>Live scanning devices in {deviceData.gateway}...</h3>
              </div>
              <Loader2 className="animate-spin" size={20} color="var(--accent-primary)" />
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #818cf8)' }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)' }}>
              <Globe size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Network Configuration</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Main Gateway</span>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace' }}>{deviceData.gateway || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subnet / NetID</span>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace' }}>{deviceData.network_id || deviceData.subnet || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>DHCP Range</span>
              <span style={{ fontWeight: 600 }}>{deviceData.dhcp || '-'}</span>
            </div>
          </div>
        </div>

        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(129, 140, 248, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#818cf8' }}>
              <Shield size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sub-Gateways & MPLS</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sub-IP 1</span>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace' }}>{deviceData.sub_ip1_gateway || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sub-IP 2</span>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace' }}>{deviceData.sub_ip2_gateway || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>WAN MPLS</span>
              <span style={{ fontWeight: 600, fontFamily: 'ui-monospace' }}>{deviceData.wan_gateway_mpls || '-'}</span>
            </div>
          </div>
        </div>

        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-success)' }}>
              <Users size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Connectivity Discovery</h3>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <h2 style={{ margin: 0, fontSize: '2.5rem', color: scannedClients.length > 0 ? 'var(--accent-success)' : 'inherit' }}>
              {scannedClients.length}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Discovered Devices</p>
          </div>
        </div>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Client Devices Information</h3>
          {scannedClients.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)', fontWeight: 600 }}>
              {scannedClients.length} devices detected
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Client Name</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>IP Address</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>MAC Address</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Last Online</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((client, index) => {
                const diff = new Date() - new Date(client.last_online);
                const isOnline = client.last_online && diff >= 0 && diff < 300000; // 5 mins
                return (
                  <tr key={client.id || index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{client.client_name || 'Unknown Device'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'ui-monospace', color: 'var(--accent-primary)' }}>{client.ip_address}</td>
                    <td style={{ padding: '1rem 1.5rem', fontFamily: 'ui-monospace', color: 'var(--text-secondary)' }}>{client.mac_address}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                        background: isOnline ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isOnline ? 'var(--accent-success)' : 'var(--accent-error)',
                        fontWeight: 600
                      }}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {client.last_online ? new Date(client.last_online).toLocaleString('th-TH') : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {scannedClients.length === 0 && scanStatus !== 'scanning' && (
                <tr>
                  <td colSpan="4" style={{ padding: '5rem', textAlign: 'center' }}>
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}
                    >
                      <Users size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
                      <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Client Data</h4>
                      <p style={{ marginBottom: '1.5rem' }}>This segment hasn't been scanned or no active devices were found. Start a live scan to discover users.</p>
                      <button
                        onClick={startScan}
                        className="glass"
                        style={{ padding: '0.75rem 2rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Start Live Scan
                      </button>
                    </motion.div>
                  </td>
                </tr>
              )}
              {scanStatus === 'scanning' && currentItems.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
                      <p style={{ color: 'var(--text-secondary)' }}>Discovering devices and syncing with backend...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => paginate(currentPage - 1)}
              className="glass"
              style={{ padding: '0.5rem 1rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#fff', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.9rem' }}>Go to:</span>
              <select
                value={currentPage}
                onChange={(e) => paginate(Number(e.target.value))}
                className="glass"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {[...Array(totalPages).keys()].map(n => (
                  <option key={n + 1} value={n + 1} style={{ background: '#1e293b' }}>
                    Page {n + 1}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.9rem' }}>of {totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => paginate(currentPage + 1)}
              className="glass"
              style={{ padding: '0.5rem 1rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: '#fff', opacity: currentPage === totalPages ? 0.3 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DeviceDetails;
