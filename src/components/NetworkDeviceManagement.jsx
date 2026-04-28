import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import { ArrowLeft, Loader2, Edit2, Trash2, Plus, Save, AlertTriangle, ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NetworkDeviceManagement = ({ token, onBack, user }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [responseModal, setResponseModal] = useState(null); // { type: 'success' | 'error', message: string }

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [devicesPerPage, setDevicesPerPage] = useState(10);
  const [selectedType, setSelectedType] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const peaTypes = React.useMemo(() => {
    const types = new Set(devices.map(d => d.pea_type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [devices]);

  // Read-only for roles other than super_admin and network_admin
  const canEdit = user?.role === 'super_admin' || user?.role === 'network_admin';

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.data) {
        setDevices(result.data);
      } else if (Array.isArray(result)) {
        setDevices(result);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleEditClick = (device) => {
    if (!canEdit) return;
    setEditingDevice(device);
    setFormData(device);
  };

  const handleAddClick = () => {
    if (!canEdit) return;
    setEditingDevice({ isNew: true });
    setFormData({
      pea_type: "",
      pea_name: "",
      province: "",
      web: "",
      gateway: "",
      dhcp: "",
      network_id: "",
      subnet: "",
      sub_ip1_gateway: "",
      sub_ip1_subnet: "",
      sub_ip2_gateway: "",
      sub_ip2_subnet: "",
      wan_gateway_mpls: "",
      wan_ip_fgt: "",
      vpn_main: "",
      vpn_backup: "",
      gateway_backup: ""
    });
  };

  const handleCancelEdit = () => {
    setEditingDevice(null);
    setFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    
    setActionLoading(true);
    const isNew = editingDevice.isNew;
    const url = isNew 
      ? `${import.meta.env.VITE_API_BASE_URL}/api/devices` 
      : `${import.meta.env.VITE_API_BASE_URL}/api/devices/${editingDevice.id}`;
    
    try {
      // Use URLSearchParams to match qs.stringify behavior (application/x-www-form-urlencoded)
      const params = new URLSearchParams();
      Object.keys(formData).forEach(key => {
        if (key !== 'index' && formData[key] !== null && formData[key] !== undefined) {
          params.append(key, formData[key]);
        }
      });

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: params.toString()
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setResponseModal({
          type: 'success',
          message: result.message || (isNew ? 'เพิ่มอุปกรณ์สำเร็จ' : 'แก้ไขข้อมูลอุปกรณ์สำเร็จ')
        });
        await fetchDevices();
        handleCancelEdit();
      } else {
        setResponseModal({
          type: 'error',
          message: result.message || result.error || 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง'
        });
      }
    } catch (err) {
      console.error('Error saving device:', err);
      setResponseModal({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!canEdit || !deviceToDelete) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/devices/${deviceToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setResponseModal({
          type: 'success',
          message: result.message || 'ลบอุปกรณ์สำเร็จ'
        });
        await fetchDevices();
      } else {
        setResponseModal({
          type: 'error',
          message: result.message || result.error || 'ลบอุปกรณ์ไม่สำเร็จ'
        });
      }
    } catch (err) {
      console.error('Error deleting device:', err);
      setResponseModal({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'
      });
    } finally {
      setActionLoading(false);
      setDeviceToDelete(null);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
      key = null;
    }
    setSortConfig({ key, direction });
  };

  // Filter logic
  const filteredDevices = React.useMemo(() => {
    let result = devices.filter(device => {
      const matchesSearch = !searchTerm || (
        (device.pea_name && String(device.pea_name).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.pea_type && String(device.pea_type).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.gateway && String(device.gateway).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.province && String(device.province).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (device.network_id && String(device.network_id).toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const matchesType = selectedType === 'All' || device.pea_type === selectedType;

      return matchesSearch && matchesType;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
        const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [devices, searchTerm, selectedType, sortConfig]);

  // Pagination Logic
  const indexOfLastDevice = currentPage * devicesPerPage;
  const indexOfFirstDevice = indexOfLastDevice - devicesPerPage;
  const currentDevices = filteredDevices.slice(indexOfFirstDevice, indexOfLastDevice);
  const totalPages = Math.ceil(filteredDevices.length / devicesPerPage);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const exportToPDF = () => {
    const element = document.getElementById('management-table-container');
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Device_Management_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      toast.success('PDF Exported Successfully');
    }).catch(err => {
      console.error('PDF Export Error:', err);
      toast.error('Failed to export PDF');
    });
  };

  // Fields to display in the form
  const formFields = [
    { name: 'pea_type', label: 'PEA Type', type: 'text' },
    { name: 'pea_name', label: 'PEA Name', type: 'text' },
    { name: 'province', label: 'Province', type: 'text' },
    { name: 'web', label: 'Web', type: 'text' },
    { name: 'gateway', label: 'Gateway IP', type: 'text' },
    { name: 'dhcp', label: 'DHCP Range', type: 'text' },
    { name: 'network_id', label: 'Network ID', type: 'text' },
    { name: 'subnet', label: 'Subnet', type: 'text' },
    { name: 'sub_ip1_gateway', label: 'Sub IP1 Gateway', type: 'text' },
    { name: 'sub_ip1_subnet', label: 'Sub IP1 Subnet', type: 'text' },
    { name: 'sub_ip2_gateway', label: 'Sub IP2 Gateway', type: 'text' },
    { name: 'sub_ip2_subnet', label: 'Sub IP2 Subnet', type: 'text' },
    { name: 'wan_gateway_mpls', label: 'WAN Gateway MPLS', type: 'text' },
    { name: 'wan_ip_fgt', label: 'WAN IP FGT', type: 'text' },
    { name: 'vpn_main', label: 'VPN Main', type: 'text' },
    { name: 'vpn_backup', label: 'VPN Backup', type: 'text' },
    { name: 'gateway_backup', label: 'Gateway Backup', type: 'text' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={onBack}
            className="glass"
            style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft size={16} /> กลับ
          </button>
          
          {!editingDevice && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    paddingRight: '1.5rem',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right center',
                    backgroundSize: '1rem'
                  }}
                >
                  {peaTypes.map(type => (
                    <option key={type} value={type} style={{ background: '#1e293b' }}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
                <select
                  value={devicesPerPage}
                  onChange={(e) => {
                    setDevicesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    paddingRight: '1.5rem',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right center',
                    backgroundSize: '1rem'
                  }}
                >
                  <option value="10" style={{ background: '#1e293b' }}>10</option>
                  <option value="25" style={{ background: '#1e293b' }}>25</option>
                  <option value="50" style={{ background: '#1e293b' }}>50</option>
                  <option value="100" style={{ background: '#1e293b' }}>100</option>
                </select>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาอุปกรณ์..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem 0.5rem 2.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    outline: 'none',
                    width: '200px'
                  }}
                />
              </div>

              <button
                onClick={exportToPDF}
                className="glass"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0.5rem 1rem', 
                  gap: '0.5rem', 
                  borderRadius: '0.5rem',
                  color: 'var(--accent-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <Download size={18} /> Export PDF
              </button>
            </div>
          )}
        </div>
        
        {canEdit && !editingDevice && (
          <button 
            onClick={handleAddClick} 
            className="glass" 
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <Plus size={16} /> เพิ่มอุปกรณ์ (Add Device)
          </button>
        )}
      </div>

      {editingDevice ? (
        <div className="card glass" style={{ padding: '2rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            {editingDevice.isNew ? 'เพิ่มอุปกรณ์เครือข่าย' : 'แก้ไขอุปกรณ์เครือข่าย'}
          </h2>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {formFields.map(field => (
              <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleInputChange}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white'
                  }}
                  required={field.name === 'pea_name' || field.name === 'gateway'}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="glass"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                disabled={actionLoading}
              >
                ยกเลิก (Cancel)
              </button>
              <button 
                type="submit" 
                style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                บันทึก (Save)
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div id="management-table-container" className="card glass" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', width: '80px' }}>
                    Sequence
                  </th>
                  <th 
                    style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => requestSort('pea_name')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      ชื่ออุปกรณ์ (PEA Name) {sortConfig.key === 'pea_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                    </div>
                  </th>
                  <th 
                    style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => requestSort('pea_type')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      ประเภท (Type) {sortConfig.key === 'pea_type' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                    </div>
                  </th>
                  <th 
                    style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => requestSort('gateway')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      ไอพี (Gateway) {sortConfig.key === 'gateway' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                    </div>
                  </th>
                  <th 
                    style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => requestSort('province')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      จังหวัด (Province) {sortConfig.key === 'province' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}
                    </div>
                  </th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>จัดการ (Actions)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '1rem' }}>Loading devices...</p>
                    </td>
                  </tr>
                ) : devices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      ไม่พบข้อมูลอุปกรณ์
                    </td>
                  </tr>
                ) : (
                  currentDevices.map((device, index) => (
                    <tr key={device.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                      <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {indexOfFirstDevice + index + 1}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>{device.pea_name || '-'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{device.pea_type || '-'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{device.gateway || '-'}</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{device.province || '-'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEditClick(device)}
                            className="glass"
                            style={{ padding: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', borderRadius: '0.25rem', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}
                            disabled={!canEdit}
                            title={canEdit ? "Edit Device" : "Read-only access"}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeviceToDelete(device)}
                            className="glass"
                            style={{ padding: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '0.25rem', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}
                            disabled={!canEdit}
                            title={canEdit ? "Delete Device" : "Read-only access"}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {!loading && filteredDevices.length > devicesPerPage && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Showing {indexOfFirstDevice + 1} to {Math.min(indexOfLastDevice, filteredDevices.length)} of {filteredDevices.length} entries
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="glass"
                  style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, color: 'var(--text-primary)' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="glass"
                  style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, color: 'var(--text-primary)' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deviceToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999
            }}
            onClick={() => !actionLoading && setDeviceToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>ยืนยันการลบอุปกรณ์</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบอุปกรณ์ <strong style={{ color: 'var(--text-primary)' }}>{deviceToDelete.pea_name || 'นี้'}</strong>?<br/>การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setDeviceToDelete(null)}
                  disabled={actionLoading}
                  className="glass"
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', flex: 1 }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoading}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Response Message Modal */}
      <AnimatePresence>
        {responseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10000
            }}
            onClick={() => setResponseModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ 
                padding: '2.5rem', 
                maxWidth: '450px', 
                width: '90%', 
                textAlign: 'center', 
                border: `1px solid ${responseModal.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 20px ${responseModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
              }}
            >
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: responseModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                color: responseModal.type === 'success' ? '#10b981' : '#ef4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 1.5rem',
                fontSize: '2rem'
              }}>
                {responseModal.type === 'success' ? '✓' : '✕'}
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.5rem', fontWeight: 700 }} className="krub-bold">
                {responseModal.type === 'success' ? 'สำเร็จ' : 'เกิดข้อผิดพลาด'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2.5rem', lineHeight: 1.6, fontSize: '1.05rem' }}>
                {responseModal.message}
              </p>
              
              <button
                onClick={() => setResponseModal(null)}
                style={{ 
                  padding: '0.875rem 2rem', 
                  borderRadius: '0.75rem', 
                  border: 'none', 
                  background: responseModal.type === 'success' ? '#10b981' : '#ef4444', 
                  color: 'white', 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  width: '100%',
                  fontSize: '1rem',
                  transition: 'transform 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ตกลง
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NetworkDeviceManagement;
