import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ChevronLeft, Share2, Globe, Shield, Cpu, Users, ArrowRight, Loader2, Search, RefreshCw, Clock, CalendarDays, CalendarRange, Activity, Calendar, FileSpreadsheet, Boxes, X } from 'lucide-react';
import AvailabilityHistoryChart from './AvailabilityHistoryChart';
import * as XLSX from 'xlsx';

// Matches the status badge colors used in OfficeEquipmentManagement.jsx
const statusColorFor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

const DeviceDetails = ({ deviceId, onBack, onManageSiteEquipment, user, token }) => {
  const isAdmin = user && ['computer_admin', 'network_admin', 'super_admin'].includes(user.role);
  // Same access gate as the "การจัดการ" (Management) item in the Sidebar.
  const canManageSites = user && ['computer_admin', 'network_admin', 'super_admin', 'manager', 'operator'].includes(user.role);
  const [deviceData, setDeviceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, completed
  const [scannedClients, setScannedClients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [availability, setAvailability] = useState({
    day: null,
    week: null,
    month: null,
    year: null
  });
  const [realtimeStats, setRealtimeStats] = useState({
    status: 'loading',
    latency: null,
    packetLoss: null,
    lastUpdated: null
  });
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  // Live per-IP check results for the client list table, keyed by ip_address.
  // Kept separate from the scanned `last_online` timestamps -- this is an
  // on-demand real-time probe (GET /api/test/check-ip/:ip), not tied to scan freshness.
  const [ipCheckResults, setIpCheckResults] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [availabilityHistory, setAvailabilityHistory] = useState([]);
  const [fullAvailabilityHistory, setFullAvailabilityHistory] = useState([]);
  const [downtimeHistory, setDowntimeHistory] = useState([]);
  const [currentDowntimePage, setCurrentDowntimePage] = useState(1);
  const itemsPerPage = 10;
  const scanTimeoutRef = useRef(null);
  const [equipmentDetail, setEquipmentDetail] = useState(null);
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

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

  const handleEquipmentRowClick = async (client) => {
    if (client.source !== 'equipment' || !client.equipmentId) return;
    setShowEquipmentModal(true);
    setLoadingEquipmentDetail(true);
    setEquipmentDetail(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${client.equipmentId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) {
        setEquipmentDetail(result.data);
      } else {
        toast.error('ไม่สามารถโหลดรายละเอียดอุปกรณ์ได้');
        setShowEquipmentModal(false);
      }
    } catch (error) {
      console.error('Error fetching equipment detail:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setShowEquipmentModal(false);
    } finally {
      setLoadingEquipmentDetail(false);
    }
  };

  const fetchRealtimeStats = async () => {
    try {
      const metricsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/metrics`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const metricsResult = await metricsRes.json();
      if (metricsResult.success && metricsResult.data) {
        // deviceId can arrive as a number (clicked from a list) or a string
        // (restored from the URL after browser back/forward), so compare as strings.
        const currentStats = metricsResult.data.find(d => String(d.device_id ?? d.id) === String(deviceId));
        if (currentStats) {
          setRealtimeStats({
            status: (currentStats.alive === false || currentStats.status === 'down' || currentStats.status === 'offline') ? 'offline' :
              (currentStats.alive === true || currentStats.status === 'up' || currentStats.status === 'online' || currentStats.latency_ms !== null || currentStats.latency !== null) ? 'online' : 'offline',
            latency: currentStats.latency_ms,
            packetLoss: currentStats.packet_loss,
            lastUpdated: currentStats.updated_at || currentStats.checked_at || new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Error fetching realtime stats:', err);
    }
  };

  const handleManualStatusCheck = async () => {
    setRefreshingStatus(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/check/${deviceId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        // After checking, re-fetch the latest metrics to update UI
        await fetchRealtimeStats();
      }
    } catch (error) {
      console.error('Error checking device status:', error);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleCheckIp = async (ip) => {
    if (!ip) return;
    setIpCheckResults(prev => ({ ...prev, [ip]: { ...prev[ip], checking: true } }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/test/check-ip/${ip}`);
      const result = await response.json();
      setIpCheckResults(prev => ({
        ...prev,
        [ip]: {
          checking: false,
          alive: !!result.alive,
          latency_ms: result.latency_ms,
          packet_loss: result.packet_loss,
          checked_at: result.checked_at
        }
      }));
    } catch (error) {
      console.error('Error checking IP status:', error);
      setIpCheckResults(prev => ({ ...prev, [ip]: { ...prev[ip], checking: false } }));
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

        // Fetch availability data
        try {
          const availRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/availability/${deviceId}`);
          const availResult = await availRes.json();
          if (availResult.success && availResult.data) {
            setAvailability({
              day: availResult.data.daily_ava,
              week: availResult.data.weekly_ava || availResult.data.week_ava,
              month: availResult.data.monthly_ava,
              year: availResult.data.yearly_ava
            });
          }
        } catch (err) {
          console.error('Error fetching availability:', err);
        }

        // Fetch availability snapshots for history chart
        try {
          const snapshotsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/latency/availability-snapshots/${deviceId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          const snapshotsResult = await snapshotsRes.json();
          if (snapshotsResult.success && snapshotsResult.data) {
            const formattedHistory = snapshotsResult.data.map(d => {
              const dateString = d.date || d.createdAt;
              const dateObj = new Date(dateString);
              return {
                time: isNaN(dateObj.getTime()) ? 'Invalid Date' : dateObj.toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }),
                value: parseFloat(parseFloat(d.uptime_pct || 0).toFixed(2))
              };
            });
            // Keep the raw history for the report, show only 30 days on chart
            setFullAvailabilityHistory(snapshotsResult.data);
            setAvailabilityHistory(formattedHistory.slice(-30));
          }
        } catch (err) {
          console.error('Error fetching availability snapshots:', err);
        }

        // Fetch downtime history
        try {
          const downtimeRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/${deviceId}/downtime`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          const downtimeResult = await downtimeRes.json();
          if (downtimeResult.success && downtimeResult.data) {
            setDowntimeHistory(downtimeResult.data);
          }
        } catch (err) {
          console.error('Error fetching downtime history:', err);
        }

        // Fetch real-time latency metrics
        await fetchRealtimeStats();
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

  const formatDuration = (durationStr) => {
    if (!durationStr) return '-';
    // Format is Days:Hours:Minutes:Seconds
    const parts = durationStr.split(':').map(Number);
    if (parts.length !== 4) return durationStr;
    
    const [d, h, m, s] = parts;
    const result = [];
    if (d > 0) result.push(`${d} วัน`);
    if (h > 0) result.push(`${h} ชั่วโมง`);
    if (m > 0) result.push(`${m} นาที`);
    if (s > 0) result.push(`${s} วินาที`);
    
    return result.length > 0 ? result.join(' ') : '-';
  };

  const startScan = async () => {
    if (!isAdmin) {
      toast.error('สิทธิ์การใช้งานไม่เพียงพอ: กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบเพื่อเริ่มการสแกนอุปกรณ์', {
        icon: '⚠️',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff',
          border: '1px solid rgba(244, 63, 94, 0.2)'
        },
      });
      return;
    }
    setScanStatus('scanning');
    try {
      const scanIndex = deviceData.index || deviceId;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/clients/scan/${scanIndex}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();

      if (result.success) {
        scanTimeoutRef.current = setTimeout(async () => {
          await fetchResults();
          setScanStatus('completed');
          scanTimeoutRef.current = null;
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

  // Exports the full availability history for this device, not just
  // whatever range/page the chart happens to be showing on screen.
  const handleExportExcel = () => {
    if (fullAvailabilityHistory.length === 0) {
      toast.error('ไม่มีข้อมูลประวัติความพร้อมใช้งานสำหรับส่งออก');
      return;
    }
    setIsExporting(true);
    try {
      const rows = fullAvailabilityHistory.map(item => {
        const dateString = item.date || item.createdAt;
        const dateObj = new Date(dateString);
        const displayDate = isNaN(dateObj.getTime()) ? 'Invalid Date' : dateObj.toLocaleDateString('th-TH', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
        return {
          'วันที่ (date)': displayDate,
          'Uptime Percent (uptime_pct)': item.uptime_pct != null ? parseFloat(item.uptime_pct).toFixed(2) : '-',
          'Average Latency (avg_latency_ms)': item.avg_latency_ms != null ? parseFloat(item.avg_latency_ms).toFixed(2) : '-'
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Availability');
      XLSX.writeFile(workbook, `Device_Report_${deviceData?.pea_name || 'Network'}.xlsx`);
      toast.success(`ส่งออก Excel สำเร็จ (${rows.length} รายการ)`, { icon: '📊' });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('ส่งออก Excel ไม่สำเร็จ');
    } finally {
      setIsExporting(false);
    }
  };

  // Merge the office equipment registered under this device's pea_site with the
  // live network scan results: if a scanned client's IP matches a piece of
  // equipment, that scan result IS the status check for that equipment (rather
  // than showing up as a separate "Unknown Device" row). Scanned clients whose
  // IP doesn't match any known equipment still show up on their own.
  const mergedDeviceList = React.useMemo(() => {
    const equipmentList = deviceData?.pea_site?.equipment || [];
    const usedClientKeys = new Set();

    const fromEquipment = equipmentList.map(eq => {
      const matchedScan = eq.ip_address
        ? scannedClients.find(c => c.ip_address && c.ip_address === eq.ip_address)
        : null;
      if (matchedScan) usedClientKeys.add(matchedScan.id ?? matchedScan.ip_address);
      return {
        id: `equipment-${eq.id}`,
        equipmentId: eq.id,
        source: 'equipment',
        client_name: eq.name,
        ip_address: eq.ip_address,
        mac_address: eq.mac_address || matchedScan?.mac_address,
        department: eq.department,
        equipment_type: eq.equipment_type,
        last_online: matchedScan?.last_online || null,
        matchedScan: !!matchedScan
      };
    });

    const fromScanOnly = scannedClients
      .filter(c => !usedClientKeys.has(c.id ?? c.ip_address))
      .map((c, index) => ({
        id: c.id ?? `scan-${c.ip_address || index}`,
        source: 'scan',
        client_name: c.client_name || 'Unknown Device',
        ip_address: c.ip_address,
        mac_address: c.mac_address,
        department: null,
        equipment_type: null,
        last_online: c.last_online,
        matchedScan: true
      }));

    // Ascending by IP (.1 up to .254). Missing/malformed addresses sort to
    // the bottom regardless of direction.
    const ipToNum = (ip) => {
      const parts = (ip || '').split('.').map(Number);
      if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return -1;
      return parts.reduce((acc, n) => acc * 256 + n, 0);
    };

    const byIpAsc = (a, b) => {
      const an = ipToNum(a.ip_address);
      const bn = ipToNum(b.ip_address);
      if (an === -1 && bn === -1) return 0;
      if (an === -1) return 1;
      if (bn === -1) return -1;
      return an - bn;
    };

    // Keep registered equipment and scan-only ("Unknown Device") entries in
    // separate blocks -- sorted by IP within each -- rather than interleaved.
    return [...fromEquipment.sort(byIpAsc), ...fromScanOnly.sort(byIpAsc)];
  }, [deviceData, scannedClients]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = mergedDeviceList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(mergedDeviceList.length / itemsPerPage);

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
      id="device-report-content"
    >
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onBack}
            className="glass"
            data-html2canvas-ignore="true"
            style={{
              padding: '0.75rem',
              borderRadius: '50%',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>{deviceData.pea_name}</h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>ตรวจสอบสถานะเครือข่ายและการเชื่อมต่ออุปกรณ์ภายในสำนักงาน</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }} data-html2canvas-ignore="true">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="glass"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              color: 'var(--accent-primary)',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isExporting ? 0.7 : 1,
              fontWeight: 600
            }}
            title="Export Report to Excel"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={fetchResults}
            className="glass"
            style={{ padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}
            title="Refresh Discovery Info (Local Network Scan)"
          >
            <RefreshCw size={18} className={scanStatus === 'scanning' ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={startScan}
            disabled={scanStatus === 'scanning' || !isAdmin}
            className="glass"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              background: !isAdmin ? 'linear-gradient(135deg, var(--accent-primary), #c881f8ff)' : 'linear-gradient(135deg, var(--accent-primary), #c881f8ff)',
              color: '#ffffff',
              border: !isAdmin ? '1px solid var(--border-subtle)' : 'none',
              fontWeight: 600,
              cursor: (scanStatus === 'scanning' || !isAdmin) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: !isAdmin ? 'none' : '0 4px 20px rgba(168, 85, 247, 0.3)',
              opacity: (scanStatus === 'scanning' || !isAdmin) ? 0.7 : 1
            }}
            title={!isAdmin ? 'Administrative role required for live scanning' : ''}
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
            <div style={{ height: '4px', background: 'var(--glass-bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #818cf8)' }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Real-time Status & Latency Card */}
        <div className="card glass" style={{
          background: realtimeStats.status === 'online' ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
          border: `1px solid ${realtimeStats.status === 'online' ? 'var(--border-success)' : 'var(--border-danger)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: realtimeStats.status === 'online' ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                padding: '0.5rem', borderRadius: '0.5rem',
                color: realtimeStats.status === 'online' ? 'var(--accent-success)' : 'var(--accent-danger)'
              }}>
                <Activity size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>สถานะอุปกรณ์</h3>
            </div>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              background: realtimeStats.status === 'online' ? 'var(--accent-success)' : 'var(--accent-danger)',
              color: '#fff',
              textTransform: 'uppercase'
            }}>
              {realtimeStats.status}
            </div>
          </div>

          {realtimeStats.lastUpdated && (
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              <Clock size={12} />
              <span>อัปเดตล่าสุด: {new Date(realtimeStats.lastUpdated).toLocaleTimeString('th-TH')}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Current Latency</p>
              <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: realtimeStats.status === 'online' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {realtimeStats.latency !== null ? `${realtimeStats.latency.toFixed(1)}ms` : '--'}
              </h2>
            </div>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Packet Loss</p>
              <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: (realtimeStats.packetLoss || 0) > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {realtimeStats.packetLoss !== null ? `${realtimeStats.packetLoss}%` : '--'}
              </h2>
            </div>
          </div>

          <button
            onClick={handleManualStatusCheck}
            disabled={refreshingStatus}
            style={{
              width: '100%',
              padding: '0.6rem',
              borderRadius: '0.5rem',
              background: realtimeStats.status === 'online' ? 'var(--accent-success)' :
                realtimeStats.status === 'offline' ? 'var(--accent-danger)' :
                  'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: '#fff',
              boxShadow: realtimeStats.status === 'online' ? '0 4px 12px rgba(34, 197, 94, 0.3)' :
                realtimeStats.status === 'offline' ? '0 4px 12px rgba(239, 68, 68, 0.3)' :
                  '0 4px 12px rgba(168, 85, 247, 0.3)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: refreshingStatus ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: refreshingStatus ? 0.7 : 1
            }}
            className="refresh-button-hover"
            title="Update connectivity status"
          >
            <RefreshCw size={14} className={refreshingStatus ? 'animate-spin' : ''} />
            {refreshingStatus ? 'กำลังตรวจสอบ...' : 'ตรวจสอบเดี๋ยวนี้!'}
          </button>
        </div>

        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-accent-subtle)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)' }}>
              <Globe size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Network Configuration</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Main Gateway</span>
              <span style={{
                fontWeight: 600,
                fontFamily: 'ui-monospace',
                filter: !user ? 'blur(4px)' : 'none',
                transition: 'filter 0.3s ease',
                userSelect: !user ? 'none' : 'auto'
              }}>{deviceData.gateway || '-'}</span>
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
              <span style={{
                fontWeight: 600,
                fontFamily: 'ui-monospace',
                filter: !user ? 'blur(4px)' : 'none',
                transition: 'filter 0.3s ease',
                userSelect: !user ? 'none' : 'auto'
              }}>{deviceData.sub_ip1_gateway || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sub-IP 2</span>
              <span style={{
                fontWeight: 600,
                fontFamily: 'ui-monospace',
                filter: !user ? 'blur(4px)' : 'none',
                transition: 'filter 0.3s ease',
                userSelect: !user ? 'none' : 'auto'
              }}>{deviceData.sub_ip2_gateway || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>WAN MPLS</span>
              <span style={{
                fontWeight: 600,
                fontFamily: 'ui-monospace',
                filter: !user ? 'blur(4px)' : 'none',
                transition: 'filter 0.3s ease',
                userSelect: !user ? 'none' : 'auto'
              }}>{deviceData.wan_gateway_mpls || '-'}</span>
            </div>
          </div>
        </div>

        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-success-subtle)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-success)' }}>
              <Users size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>จำนวนอุปกรณ์ในสำนักงาน</h3>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <h2 style={{ margin: 0, fontSize: '2.5rem', color: mergedDeviceList.length > 0 ? 'var(--accent-success)' : 'var(--text-primary)' }}>
              {mergedDeviceList.length}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Discovered Devices</p>
          </div>
        </div>
      </div>

      {/* System Availability Section */}
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
        <Activity size={24} color="var(--accent-primary)" />
        รายงานความพร้อมใช้ของอุปกรณ์เครือข่ายภายในสำนักงาน
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>

        {/* Daily Availability */}
        <div className="card glass" style={{
          position: 'relative', overflow: 'hidden',
          background: 'var(--glass-bg-subtle)'
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%)',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--accent-primary)' }}>
              <Clock size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>รายวัน (24 ชั่วโมง)</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {availability.day ?? deviceData?.availability_day ?? '100'}%
            </span>
          </div>
          <div style={{ marginTop: '1rem', height: '6px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${availability.day ?? deviceData?.availability_day ?? 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), #d946ef)' }}
            />
          </div>
        </div>

        {/* Weekly Availability */}
        <div className="card glass" style={{
          position: 'relative', overflow: 'hidden',
          background: 'var(--glass-bg-subtle)'
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
            background: 'radial-gradient(circle, rgba(234, 179, 8, 0.1) 0%, rgba(0,0,0,0) 70%)',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--accent-secondary)' }}>
              <CalendarDays size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>รายสัปดาห์ (7 วัน)</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {availability.week ?? deviceData?.availability_week ?? '99.8'}%
            </span>
          </div>
          <div style={{ marginTop: '1rem', height: '6px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${availability.week ?? deviceData?.availability_week ?? 99.8}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-secondary), #f59e0b)' }}
            />
          </div>
        </div>

        {/* Monthly Availability */}
        <div className="card glass" style={{
          position: 'relative', overflow: 'hidden',
          background: 'var(--glass-bg-subtle)'
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
            background: 'radial-gradient(circle, rgba(248, 250, 252, 0.05) 0%, rgba(0,0,0,0) 70%)',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary-subtle)', padding: '0.75rem', borderRadius: '0.75rem', color: 'var(--text-primary)' }}>
              <CalendarRange size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>รายเดือน (30 วัน)</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {availability.month ?? deviceData?.availability_month ?? '99.5'}%
            </span>
          </div>
          <div style={{ marginTop: '1rem', height: '6px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${availability.month ?? deviceData?.availability_month ?? 99.5}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
              style={{ height: '100%', background: 'linear-gradient(90deg, var(--text-primary), var(--text-secondary))' }}
            />
          </div>
        </div>

        {/* Yearly Availability */}
        <div className="card glass" style={{
          position: 'relative', overflow: 'hidden',
          background: 'var(--glass-bg-subtle)'
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%)',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '0.75rem', borderRadius: '0.75rem', color: '#a855f7' }}>
              <Calendar size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)' }}>รายปี (365 วัน)</h3>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {availability.year ?? '99.0'}%
            </span>
          </div>
          <div style={{ marginTop: '1rem', height: '6px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${availability.year ?? 99}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #a855f7, #eab308)' }}
            />
          </div>
        </div>

      </div>

      <AvailabilityHistoryChart history={availabilityHistory} />

      {/* Downtime History Section */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-danger-subtle)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-danger)' }}>
            <Activity size={20} />
          </div>
          <h3 style={{ margin: 0 }}>ประวัติการขัดข้อง (Downtime History)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--accent-danger)', fontSize: '0.85rem', fontWeight: 600 }}>เวลาขัดข้อง</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600 }}>เวลากลับออนไลน์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>ระยะเวลาขัดข้อง</th>
              </tr>
            </thead>
            <tbody>
              {downtimeHistory.length > 0 ? (
                downtimeHistory.slice((currentDowntimePage - 1) * itemsPerPage, currentDowntimePage * itemsPerPage).map((log, index) => (
                  <tr 
                    key={log.id || index} 
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} 
                    className="table-row-hover"
                    title={`สถานะอุปกรณ์: ${log.status.toUpperCase()}`}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--accent-danger)', fontWeight: 500 }}>
                      {new Date(log.down_at).toLocaleString('th-TH')}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: 'var(--accent-success)', fontWeight: 500 }}>
                      {log.up_at ? new Date(log.up_at).toLocaleString('th-TH') : (
                        <span style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>ยังไม่กลับมาออนไลน์</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '1.1rem', fontWeight: 700, fontFamily: '"Krub", sans-serif', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{formatDuration(log.duration_formatted)}</span>
                      <span className="status-badge-hover" style={{
                        background: log.status === 'down' ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
                        color: log.status === 'down' ? 'var(--accent-danger)' : 'var(--accent-success)'
                      }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ไม่พบประวัติการขัดข้องในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {Math.ceil(downtimeHistory.length / itemsPerPage) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              disabled={currentDowntimePage === 1}
              onClick={() => setCurrentDowntimePage(prev => Math.max(1, prev - 1))}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentDowntimePage === 1 ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentDowntimePage === 1 ? 0.3 : 1 }}
            >
              Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.9rem' }}>Go to:</span>
              <select
                value={currentDowntimePage}
                onChange={(e) => setCurrentDowntimePage(Number(e.target.value))}
                style={{
                  background: 'var(--input-bg)',
                  color: '#0f172a',
                  border: '1px solid var(--input-border)',
                  padding: '0.4rem 1.8rem 0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230f172a\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1rem'
                }}
              >
                {[...Array(Math.ceil(downtimeHistory.length / itemsPerPage)).keys()].map(n => (
                  <option key={n + 1} value={n + 1} style={{ background: '#ffffff', color: '#0f172a' }}>
                    Page {n + 1}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.9rem' }}>of {Math.ceil(downtimeHistory.length / itemsPerPage)}</span>
            </div>
            <button
              disabled={currentDowntimePage === Math.ceil(downtimeHistory.length / itemsPerPage)}
              onClick={() => setCurrentDowntimePage(prev => Math.min(Math.ceil(downtimeHistory.length / itemsPerPage), prev + 1))}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentDowntimePage === Math.ceil(downtimeHistory.length / itemsPerPage) ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentDowntimePage === Math.ceil(downtimeHistory.length / itemsPerPage) ? 0.3 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>รายการอุปกรณ์เชื่อมต่อระบบเครือข่ายภายในสำนักงาน</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {mergedDeviceList.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)', fontWeight: 600 }}>
                {mergedDeviceList.length} รายการ
              </span>
            )}
            {canManageSites && deviceData?.pea_site_id && (
              <button
                onClick={() => onManageSiteEquipment && onManageSiteEquipment(deviceData.pea_site_id)}
                className="glass"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <Boxes size={16} /> จัดการอุปกรณ์สำนักงานนี้
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
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
                const notScanned = client.source === 'equipment' && !client.matchedScan;
                const isEquipment = client.source === 'equipment';
                // A manual "เช็คสถานะ" check (GET /api/test/check-ip/:ip) is a
                // live probe, so it takes priority over the scan-age-based isOnline guess.
                const liveCheck = client.ip_address ? ipCheckResults[client.ip_address] : null;
                const hasLiveCheck = liveCheck && liveCheck.alive !== undefined;
                const displayOnline = hasLiveCheck ? liveCheck.alive : isOnline;
                const statusLabel = hasLiveCheck
                  ? (liveCheck.alive ? 'ONLINE' : 'OFFLINE')
                  : (isOnline ? 'ONLINE' : notScanned ? 'ไม่พบในการสแกน' : 'OFFLINE');
                return (
                  <tr
                    key={client.id || index}
                    onClick={() => isEquipment && handleEquipmentRowClick(client)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s', cursor: isEquipment ? 'pointer' : 'default' }}
                    className="table-row-hover"
                    title={isEquipment ? 'คลิกเพื่อดูรายละเอียดอุปกรณ์' : undefined}
                  >
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{client.client_name || 'Unknown Device'}</div>
                      {(client.department || client.equipment_type) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          {[client.department, client.equipment_type].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: '1rem 1.5rem',
                      fontFamily: 'ui-monospace',
                      color: 'var(--accent-primary)',
                      filter: !user ? 'blur(4px)' : 'none',
                      transition: 'filter 0.3s ease',
                      userSelect: !user ? 'none' : 'auto'
                    }}>{client.ip_address || '-'}</td>
                    <td style={{
                      padding: '1rem 1.5rem',
                      fontFamily: 'ui-monospace',
                      color: 'var(--text-secondary)',
                      filter: !user ? 'blur(4px)' : 'none',
                      transition: 'filter 0.3s ease',
                      userSelect: !user ? 'none' : 'auto'
                    }}>{client.mac_address || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '1rem',
                            background: displayOnline ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                            color: displayOnline ? 'var(--accent-success)' : 'var(--accent-danger)',
                            fontWeight: 600
                          }}
                          title={hasLiveCheck
                            ? `เช็คล่าสุด: ${new Date(liveCheck.checked_at).toLocaleString('th-TH')}${liveCheck.alive ? ` · ${liveCheck.latency_ms}ms` : ''}`
                            : undefined}
                        >
                          {statusLabel}
                        </span>
                        {client.ip_address && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCheckIp(client.ip_address); }}
                            disabled={liveCheck?.checking}
                            title="เช็คสถานะล่าสุด"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.3rem',
                              borderRadius: '0.4rem',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--glass-bg-subtle)',
                              color: 'var(--text-secondary)',
                              cursor: liveCheck?.checking ? 'not-allowed' : 'pointer',
                              opacity: liveCheck?.checking ? 0.6 : 1
                            }}
                          >
                            <RefreshCw size={12} className={liveCheck?.checking ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {client.last_online ? new Date(client.last_online).toLocaleString('th-TH') : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {mergedDeviceList.length === 0 && scanStatus !== 'scanning' && (
                <tr>
                  <td colSpan="5" style={{ padding: '5rem', textAlign: 'center' }}>
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}
                    >
                      <Users size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Client Data</h4>
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
                  <td colSpan="5" style={{ padding: '5rem', textAlign: 'center' }}>
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
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '0.9rem' }}>Go to:</span>
              <select
                value={currentPage}
                onChange={(e) => paginate(Number(e.target.value))}
                style={{
                  background: 'var(--input-bg)',
                  color: '#0f172a',
                  border: '1px solid var(--input-border)',
                  padding: '0.4rem 1.8rem 0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230f172a\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1rem'
                }}
              >
                {[...Array(totalPages).keys()].map(n => (
                  <option key={n + 1} value={n + 1} style={{ background: '#ffffff', color: '#0f172a' }}>
                    Page {n + 1}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.9rem' }}>of {totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => paginate(currentPage + 1)}
              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: '#0f172a', opacity: currentPage === totalPages ? 0.3 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Equipment Detail Modal */}
      <AnimatePresence>
        {showEquipmentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-html2canvas-ignore="true"
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: '1rem'
            }}
            onClick={() => setShowEquipmentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2rem', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>รายละเอียดอุปกรณ์</h3>
                <button
                  onClick={() => setShowEquipmentModal(false)}
                  className="glass"
                  style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              {loadingEquipmentDetail ? (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดรายละเอียด...</p>
                </div>
              ) : equipmentDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{equipmentDetail.name || '-'}</h2>
                    <span style={{
                      display: 'inline-block', marginTop: '0.5rem', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: statusColorFor(equipmentDetail.status),
                      background: `${statusColorFor(equipmentDetail.status)}15`
                    }}>
                      {equipmentDetail.status || '-'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>ประเภท:</span> {equipmentDetail.equipment_type || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>แผนก:</span> {equipmentDetail.department || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>IP Address:</span> <span style={{ fontFamily: 'monospace' }}>{equipmentDetail.ip_address || '-'}</span></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>MAC Address:</span> <span style={{ fontFamily: 'monospace' }}>{equipmentDetail.mac_address || '-'}</span></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>ผู้ขาย:</span> {equipmentDetail.vendor || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>เลขที่สัญญา:</span> {equipmentDetail.contract_no || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>วันเริ่มสัญญา:</span> {equipmentDetail.contract_start_date || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>วันหมดอายุสัญญา:</span> {equipmentDetail.contract_expiry_date || '-'}</div>
                  </div>

                  {equipmentDetail.notes && (
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>หมายเหตุ:</span> {equipmentDetail.notes}
                    </div>
                  )}

                  {equipmentDetail.pea_site && (
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>สำนักงาน:</span> {equipmentDetail.pea_site.pea_name} ({equipmentDetail.pea_site.pea_province})
                    </div>
                  )}

                  {equipmentDetail.created_by && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      บันทึกโดย {equipmentDetail.created_by.first_name} {equipmentDetail.created_by.last_name} (@{equipmentDetail.created_by.username})
                      {equipmentDetail.updatedAt && ` · แก้ไขล่าสุด ${new Date(equipmentDetail.updatedAt).toLocaleString('th-TH')}`}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>ไม่พบข้อมูล</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DeviceDetails;
