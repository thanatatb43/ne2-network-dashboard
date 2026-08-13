import React, { useState, useEffect } from 'react';
import { Users, Shield, Loader2, RefreshCw, Settings, Search, UserPlus, Filter, Trash2, Edit2, ShieldAlert, X, Save, Key, CheckCircle2, MapPin, Plus, AlertTriangle, Activity, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// "lat, long" pasted straight from Google Maps (right-click a spot -> the
// coordinates are the first item in the context menu).
const COORDINATES_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

const SortIcon = ({ sort, column }) => {
  if (sort.key !== column) return <ArrowUpDown size={12} style={{ opacity: 0.35 }} />;
  return sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
};

const AdminSettings = ({ token, user: currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('overview'); // overview, users, edit
  const [editingUser, setEditingUser] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({ password: '', confirm_password: '' });
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [editingLocation, setEditingLocation] = useState(null); // null | { isNew: true } | site object
  const [locationFormData, setLocationFormData] = useState({ pea_name: '', pea_province: '', coordinates: '' });
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [locationSort, setLocationSort] = useState({ key: 'pea_name', direction: 'asc' });
  const [locationProvinceFilter, setLocationProvinceFilter] = useState('all');
  const [locationCoordsFilter, setLocationCoordsFilter] = useState('all'); // all | has | none
  const [locationDeviceFilter, setLocationDeviceFilter] = useState('all'); // all | linked | unlinked | online | offline
  const [deletingLocation, setDeletingLocation] = useState(false);

  const isReadOnly = currentUser?.role === 'manager' || currentUser?.role === 'operator';
  // Only super_admin can create/edit/delete PEA sites; GET is public so
  // anyone who lands on this view can still see the list.
  const canManageLocations = currentUser?.role === 'super_admin';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data.data && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'users') {
      fetchUsers();
    } else if (view === 'locations') {
      fetchLocations();
    }
  }, [view]);

  const fetchLocations = async () => {
    setLoadingLocations(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites`);
      const data = await response.json();
      const list = data.data || data;
      setLocations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch PEA sites:', err);
      toast.error('ไม่สามารถโหลดรายการสำนักงานได้');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleAddLocationClick = () => {
    if (!canManageLocations) return;
    setEditingLocation({ isNew: true });
    setLocationFormData({ pea_name: '', pea_province: '', coordinates: '' });
  };

  const handleEditLocationClick = (site) => {
    if (!canManageLocations) return;
    setEditingLocation(site);
    setLocationFormData({
      pea_name: site.pea_name || '',
      pea_province: site.pea_province || '',
      coordinates: (site.latitude != null && site.longitude != null) ? `${site.latitude}, ${site.longitude}` : ''
    });
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!canManageLocations || !editingLocation) return;

    const peaName = locationFormData.pea_name.trim();
    const peaProvince = locationFormData.pea_province.trim();
    const coordinates = locationFormData.coordinates.trim();

    if (!peaName) {
      toast.error('กรุณากรอกชื่อสำนักงาน');
      return;
    }
    if (!peaProvince) {
      toast.error('กรุณากรอกจังหวัด');
      return;
    }
    if (coordinates && !COORDINATES_PATTERN.test(coordinates)) {
      toast.error('รูปแบบพิกัดไม่ถูกต้อง ต้องเป็น "lat, long" ที่ copy จาก Google Maps เช่น 16.246825, 102.821954');
      return;
    }

    setSavingLocation(true);
    const isNew = editingLocation.isNew;
    try {
      const payload = { pea_name: peaName, pea_province: peaProvince };
      if (coordinates) payload.coordinates = coordinates;

      const url = isNew
        ? `${import.meta.env.VITE_API_BASE_URL}/api/pea-sites`
        : `${import.meta.env.VITE_API_BASE_URL}/api/pea-sites/${editingLocation.id}`;

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || (isNew ? 'เพิ่มสำนักงานสำเร็จ' : 'แก้ไขสำนักงานสำเร็จ'));
        setEditingLocation(null);
        fetchLocations();
      } else if (response.status === 409) {
        toast.error(result.message || 'ชื่อสำนักงานนี้มีอยู่แล้ว');
      } else {
        toast.error(result.message || result.error || 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
      }
    } catch (err) {
      console.error('Failed to save PEA site:', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleConfirmDeleteLocation = async () => {
    if (!canManageLocations || !locationToDelete) return;
    setDeletingLocation(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites/${locationToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'ลบสำนักงานสำเร็จ');
        setLocationToDelete(null);
        fetchLocations();
      } else {
        // 400 when the site still has network devices / office equipment / PEA jobs linked
        toast.error(result.message || result.error || 'ไม่สามารถลบสำนักงานนี้ได้');
      }
    } catch (err) {
      console.error('Failed to delete PEA site:', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setDeletingLocation(false);
    }
  };

  const locationProvinces = React.useMemo(() => {
    const set = new Set(locations.map(s => s.pea_province).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [locations]);

  const filteredLocations = locations.filter(site => {
    const q = locationSearch.toLowerCase();
    const matchesSearch = !q ||
      site.pea_name?.toLowerCase().includes(q) ||
      site.pea_province?.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (locationProvinceFilter !== 'all' && site.pea_province !== locationProvinceFilter) return false;

    const hasCoords = site.latitude != null && site.longitude != null;
    if (locationCoordsFilter === 'has' && !hasCoords) return false;
    if (locationCoordsFilter === 'none' && hasCoords) return false;

    if (locationDeviceFilter === 'linked' && !site.network_device) return false;
    if (locationDeviceFilter === 'unlinked' && site.network_device) return false;
    if (locationDeviceFilter === 'online' && site.network_device?.metrics?.status !== 'up') return false;
    if (locationDeviceFilter === 'offline' && (!site.network_device || site.network_device.metrics?.status === 'up')) return false;

    return true;
  });

  const handleLocationSort = (key) => {
    setLocationSort(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  // Value used to compare two rows for a given sortable column -- null/empty
  // always sorts to the bottom regardless of direction, so switching
  // asc/desc never buries populated rows under a pile of blanks.
  const getLocationSortValue = (site, key) => {
    if (key === 'pea_name') return site.pea_name || null;
    if (key === 'pea_province') return site.pea_province || null;
    if (key === 'coordinates') return site.latitude != null ? site.latitude : null;
    if (key === 'network_device') return site.network_device?.pea_name || null;
    return null;
  };

  const sortedLocations = [...filteredLocations].sort((a, b) => {
    const { key, direction } = locationSort;
    const aVal = getLocationSortValue(a, key);
    const bVal = getLocationSortValue(b, key);
    const aEmpty = aVal === null || aVal === '';
    const bEmpty = bVal === null || bVal === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal), 'th');
    return direction === 'asc' ? cmp : -cmp;
  });

  const handleEditClick = (user) => {
    setEditingUser({ ...user });
    setShowPasswordChange(false);
    setPasswordData({ password: '', confirm_password: '' });
    setView('edit');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);

    // Password validation if requested
    if (showPasswordChange) {
      if (passwordData.password !== passwordData.confirm_password) {
        toast.error('Passwords do not match');
        setUpdateLoading(false);
        return;
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{10,}$/;
      if (!passwordRegex.test(passwordData.password)) {
        toast.error('Password must be 10+ chars with upper, lower, and special characters');
        setUpdateLoading(false);
        return;
      }
    }

    const originalUser = users.find(u => u.id === editingUser.id);
    const isDataIdentical = 
      originalUser.first_name === editingUser.first_name &&
      originalUser.last_name === editingUser.last_name &&
      originalUser.role === editingUser.role &&
      originalUser.pea_branch === editingUser.pea_branch &&
      originalUser.pea_division === editingUser.pea_division &&
      !showPasswordChange;

    if (isDataIdentical) {
      toast('No changes detected. User information remains identical.', {
        icon: '⚠️',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      setUpdateLoading(false);
      return;
    }

    const payload = {
      first_name: editingUser.first_name,
      last_name: editingUser.last_name,
      role: editingUser.role,
      pea_branch: editingUser.pea_branch,
      pea_division: editingUser.pea_division,
      ...(showPasswordChange && { password: passwordData.password })
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success('User updated successfully');
        setView('users');
        fetchUsers();
      } else {
        toast.error(result.message || 'Failed to update user');
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Connection error while updating user');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`User @${userToDelete.username} deleted`);
        setUserToDelete(null);
        fetchUsers();
      } else {
        toast.error(result.message || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Connection error while deleting user');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.pea_branch?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-settings"
    >
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }} className="krub-bold">Admin Settings</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }} className="krub-regular">System management and access control</p>
      </header>

      <AnimatePresence mode="wait">
        {view === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}
          >
            {/* User Management Entry Card */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="card glass" 
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.2)' }}
              onClick={() => setView('users')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-primary)' }}>
                  <Users size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">User Management</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage roles and accounts</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Audit registered users, assign administrative roles, and manage branch assignments for the entire dashboard.
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                {isReadOnly ? 'View Users Directory' : 'Manage Users'}
              </button>
            </motion.div>

            {/* Locations (PEA Sites) Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="card glass"
              style={{ padding: '2rem', cursor: 'pointer', border: '1px solid rgba(234, 179, 8, 0.2)' }}
              onClick={() => setView('locations')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-secondary)' }}>
                  <MapPin size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">Locations</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage PEA Sites</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                จัดการรายชื่อ ที่ตั้ง และพิกัด (lat/long) ของสำนักงานการไฟฟ้าทั้งหมดในระบบ
              </p>
              <button className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--accent-secondary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                {canManageLocations ? 'Manage Locations' : 'View Locations'}
              </button>
            </motion.div>
          </motion.div>
        )}

        {view === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="users-list-view"
          >
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={() => setView('overview')}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                ← Back to Settings
              </button>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    <option value="10" style={{ background: '#ffffff', color: '#0f172a' }}>10</option>
                    <option value="25" style={{ background: '#ffffff', color: '#0f172a' }}>25</option>
                    <option value="50" style={{ background: '#ffffff', color: '#0f172a' }}>50</option>
                    <option value="100" style={{ background: '#ffffff', color: '#0f172a' }}>100</option>
                  </select>
                </div>
                <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem', minWidth: '250px', borderRadius: '0.5rem' }}>
                  <Search size={18} color="var(--text-secondary)" />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                    className="krub-regular"
                  />
                </div>
                <button 
                  onClick={fetchUsers} 
                  className="glass" 
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer' }}
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }} className="krub-medium">User</th>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }} className="krub-medium">Role</th>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }} className="krub-medium">Branch/Division</th>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }} className="krub-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {currentUsers.map((user) => (
                        <motion.tr 
                          key={user.id} 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="table-row-hover"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        >
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ 
                                width: '32px', height: '32px', borderRadius: '50%', 
                                background: 'var(--accent-primary)', opacity: 0.8,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8rem', fontWeight: 600, color: '#fff'
                              }}>
                                {user.username?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }} className="krub-semibold">
                                  {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{user.username}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span style={{ 
                              fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.5rem',
                              background: user.role?.includes('admin') ? 'rgba(52, 211, 153, 0.1)' : 'rgba(128,128,128,0.1)',
                              color: user.role?.includes('admin') ? 'var(--accent-success)' : 'var(--text-secondary)',
                              textTransform: 'uppercase'
                            }}>
                              {user.role}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ fontSize: '0.9rem' }} className="krub-regular">{user.pea_branch || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.pea_division || 'No Division'}</div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={(user.role === 'super_admin' || isReadOnly) ? null : () => handleEditClick(user)}
                                className="glass" 
                                style={{ 
                                  padding: '0.4rem', 
                                  border: 'none', 
                                  color: 'var(--text-secondary)', 
                                  cursor: (user.role === 'super_admin' || isReadOnly) ? 'not-allowed' : 'pointer',
                                  opacity: (user.role === 'super_admin' || isReadOnly) ? 0.5 : 1
                                }} 
                                title={isReadOnly ? 'Read-only access' : user.role === 'super_admin' ? 'Super Admin profile is protected' : 'Edit User'}
                                disabled={user.role === 'super_admin' || isReadOnly}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={isReadOnly ? null : () => setUserToDelete(user)}
                                className="glass" 
                                style={{ 
                                  padding: '0.4rem', 
                                  border: 'none', 
                                  color: 'var(--accent-danger)', 
                                  cursor: (user.role === 'super_admin' || isReadOnly) ? 'not-allowed' : 'pointer',
                                  opacity: (user.role === 'super_admin' || isReadOnly) ? 0.5 : 1
                                }} 
                                title={isReadOnly ? 'Read-only access' : user.role === 'super_admin' ? 'Super Admin cannot be removed' : 'Remove User'}
                                disabled={user.role === 'super_admin' || isReadOnly}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && !loading && (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Users size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                  <p>No users found matching your search.</p>
                </div>
              )}
              {loading && (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem' }}>Fetching user directory...</p>
                </div>
              )}

              {/* Pagination Controls */}
              {!loading && filteredUsers.length > itemsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--glass-bg-subtle)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, color: '#0f172a' }}
                    >
                      Prev
                    </button>
                    <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, color: '#0f172a' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'locations' && (
          <motion.div
            key="locations"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                onClick={() => setView('overview')}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                ← Back to Settings
              </button>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem', minWidth: '250px', borderRadius: '0.5rem' }}>
                  <Search size={18} color="var(--text-secondary)" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสำนักงาน / จังหวัด..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                    className="krub-regular"
                  />
                </div>
                <button
                  onClick={fetchLocations}
                  className="glass"
                  style={{ padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer' }}
                >
                  <RefreshCw size={18} className={loadingLocations ? 'animate-spin' : ''} />
                </button>
                {canManageLocations && (
                  <button
                    onClick={handleAddLocationClick}
                    className="glass"
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                      background: 'var(--accent-secondary)', color: '#fff', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    <Plus size={16} /> เพิ่มสำนักงาน
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>จังหวัด:</span>
                <select
                  value={locationProvinceFilter}
                  onChange={(e) => setLocationProvinceFilter(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                  {locationProvinces.map(p => (
                    <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>พิกัด:</span>
                <select
                  value={locationCoordsFilter}
                  onChange={(e) => setLocationCoordsFilter(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                  <option value="has" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>มีพิกัด</option>
                  <option value="none" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ไม่มีพิกัด</option>
                </select>
              </div>
              <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>อุปกรณ์เครือข่าย:</span>
                <select
                  value={locationDeviceFilter}
                  onChange={(e) => setLocationDeviceFilter(e.target.value)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="all" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ทั้งหมด</option>
                  <option value="linked" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>มีอุปกรณ์ผูกอยู่</option>
                  <option value="unlinked" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>ไม่มีอุปกรณ์ผูกอยู่</option>
                  <option value="online" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>Online</option>
                  <option value="offline" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>Offline</option>
                </select>
              </div>
              {(locationProvinceFilter !== 'all' || locationCoordsFilter !== 'all' || locationDeviceFilter !== 'all') && (
                <button
                  onClick={() => {
                    setLocationProvinceFilter('all');
                    setLocationCoordsFilter('all');
                    setLocationDeviceFilter('all');
                  }}
                  className="glass"
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                      {[
                        { key: 'pea_name', label: 'สำนักงาน' },
                        { key: 'pea_province', label: 'จังหวัด' },
                        { key: 'coordinates', label: 'พิกัด' },
                        { key: 'network_device', label: 'อุปกรณ์เครือข่าย' }
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleLocationSort(col.key)}
                          style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                          className="krub-medium"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {col.label} <SortIcon sort={locationSort} column={col.key} />
                          </div>
                        </th>
                      ))}
                      {canManageLocations && (
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }} className="krub-medium">จัดการ</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLocations ? (
                      <tr>
                        <td colSpan={canManageLocations ? 5 : 4} style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                          <p style={{ marginTop: '1rem' }}>กำลังโหลดรายการสำนักงาน...</p>
                        </td>
                      </tr>
                    ) : filteredLocations.length === 0 ? (
                      <tr>
                        <td colSpan={canManageLocations ? 5 : 4} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <MapPin size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                          <p>ไม่พบรายการสำนักงาน</p>
                        </td>
                      </tr>
                    ) : (
                      sortedLocations.map((site) => (
                        <tr key={site.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{site.pea_name}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{site.pea_province || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {site.latitude != null && site.longitude != null ? `${site.latitude}, ${site.longitude}` : '-'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            {site.network_device ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                                <span style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  background: site.network_device.metrics?.status === 'up' ? 'var(--accent-success)' : 'var(--accent-danger)'
                                }} />
                                {site.network_device.pea_name}
                                {site.network_device.metrics?.latency_ms != null && (
                                  <span style={{ color: 'var(--text-secondary)' }}>({site.network_device.metrics.latency_ms}ms)</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ไม่มีอุปกรณ์ผูกอยู่</span>
                            )}
                          </td>
                          {canManageLocations && (
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleEditLocationClick(site)}
                                  className="glass"
                                  style={{ padding: '0.4rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  title="แก้ไข"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setLocationToDelete(site)}
                                  className="glass"
                                  style={{ padding: '0.4rem', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
                                  title="ลบ"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'edit' && editingUser && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="edit-user-form"
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setView('users')}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <X size={16} /> Cancel Editing
              </button>
            </div>

            <div className="card glass" style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ 
                  width: '60px', height: '60px', borderRadius: '50%', 
                  background: 'var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, color: '#fff'
                }}>
                  {editingUser.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: 0 }} className="krub-bold">Edit User Profile</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>@{editingUser.username}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>First Name</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.first_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Last Name</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.last_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>System Role</label>
                    <select 
                      className="glass"
                      disabled={editingUser.role === 'super_admin'}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        background: 'var(--card-bg)', 
                        border: '1px solid var(--border-subtle)', 
                        color: editingUser.role === 'super_admin' ? 'var(--text-secondary)' : 'var(--text-primary)', 
                        outline: 'none', 
                        borderRadius: '0.5rem', 
                        appearance: 'none',
                        cursor: editingUser.role === 'super_admin' ? 'not-allowed' : 'pointer'
                      }}
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                      title={editingUser.role === 'super_admin' ? 'Super Admin role is locked' : ''}
                    >
                      <option value="user">User (Standard)</option>
                      <option value="manager">Manager (Read-only)</option>
                      <option value="operator">Operator (Read-only)</option>
                      <option value="computer_admin">Computer Admin</option>
                      <option value="network_admin">Network Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PEA Branch</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.pea_branch || ''}
                      onChange={(e) => setEditingUser({...editingUser, pea_branch: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PEA Division</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--glass-bg-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.pea_division || ''}
                      onChange={(e) => setEditingUser({...editingUser, pea_division: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ 
                  border: '1px solid rgba(168, 85, 247, 0.2)', 
                  borderRadius: '1rem', 
                  padding: '1.5rem', 
                  marginBottom: '2rem',
                  background: 'rgba(168, 85, 247, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordChange ? '1.5rem' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Key size={18} color="var(--accent-primary)" />
                      <span style={{ fontWeight: 600 }}>Security & Password</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--accent-primary)', 
                        textDecoration: 'underline', 
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      {showPasswordChange ? 'Keep Current Password' : 'Change Password'}
                    </button>
                  </div>

                  {showPasswordChange && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>New Password</label>
                        <input 
                          type="password" 
                          placeholder="Min 10 characters..."
                          className="glass"
                          style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                          value={passwordData.password}
                          onChange={(e) => setPasswordData({...passwordData, password: e.target.value})}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Confirm New Password</label>
                        <input 
                          type="password" 
                          placeholder="Repeat password..."
                          className="glass"
                          style={{ width: '100%', padding: '0.6rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Password must contain at least one uppercase letter, one lowercase letter, and one special character.
                      </div>
                    </motion.div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    type="submit"
                    disabled={updateLoading}
                    className="glass"
                    style={{ 
                      flex: 1, 
                      padding: '1rem', 
                      background: 'var(--accent-primary)', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '0.75rem', 
                      fontWeight: 700, 
                      cursor: updateLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    {updateLoading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save All Changes</>}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('users')}
                    className="glass"
                    style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userToDelete && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card glass"
              style={{
                maxWidth: '450px',
                width: '100%',
                padding: '2rem',
                textAlign: 'center',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
            >
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <Trash2 size={32} />
              </div>
              <h2 className="krub-bold" style={{ margin: '0 0 1rem' }}>Confirm User Deletion</h2>
              <p className="krub-regular" style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: '#fff' }}>@{userToDelete.username}</strong> ({userToDelete.first_name} {userToDelete.last_name})? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="glass"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--accent-danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontWeight: 700,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : 'Yes, Delete User'}
                </button>
                <button
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="glass"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingLocation && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
          }}
            onClick={() => !savingLocation && setEditingLocation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ maxWidth: '440px', width: '100%', padding: '2rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="krub-bold" style={{ margin: 0, fontSize: '1.25rem' }}>
                  {editingLocation.isNew ? 'เพิ่มสำนักงาน' : 'แก้ไขสำนักงาน'}
                </h2>
                <button
                  onClick={() => setEditingLocation(null)}
                  disabled={savingLocation}
                  className="glass"
                  style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: savingLocation ? 'not-allowed' : 'pointer', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveLocation}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    ชื่อสำนักงาน <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationFormData.pea_name}
                    onChange={(e) => setLocationFormData({ ...locationFormData, pea_name: e.target.value })}
                    className="glass"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                    placeholder="เช่น กฟจ.กาฬสินธุ์"
                  />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    จังหวัด <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationFormData.pea_province}
                    onChange={(e) => setLocationFormData({ ...locationFormData, pea_province: e.target.value })}
                    className="glass"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem' }}
                    placeholder="เช่น กาฬสินธุ์"
                  />
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    พิกัด (lat, long)
                  </label>
                  <input
                    type="text"
                    value={locationFormData.coordinates}
                    onChange={(e) => setLocationFormData({ ...locationFormData, coordinates: e.target.value })}
                    className="glass"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none', borderRadius: '0.5rem', fontFamily: 'monospace' }}
                    placeholder="16.246825, 102.821954"
                  />
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Copy ตรงจาก Google Maps: คลิกขวาที่ตำแหน่ง แล้วกดคัดลอกพิกัดที่ขึ้นบนสุดของเมนู
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem' }}>
                  <button
                    type="submit"
                    disabled={savingLocation}
                    className="glass"
                    style={{
                      flex: 1, padding: '0.85rem', background: 'var(--accent-secondary)', color: '#fff', border: 'none',
                      borderRadius: '0.75rem', fontWeight: 700, cursor: savingLocation ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}
                  >
                    {savingLocation ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLocation(null)}
                    disabled={savingLocation}
                    className="glass"
                    style={{ padding: '0.85rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', cursor: savingLocation ? 'not-allowed' : 'pointer' }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {locationToDelete && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card glass"
              style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            >
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                <AlertTriangle size={32} />
              </div>
              <h2 className="krub-bold" style={{ margin: '0 0 1rem' }}>ยืนยันการลบสำนักงาน</h2>
              <p className="krub-regular" style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
                ต้องการลบ <strong style={{ color: '#fff' }}>{locationToDelete.pea_name}</strong> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                <br /><br />
                <span style={{ fontSize: '0.8rem' }}>หากยังมีอุปกรณ์เครือข่าย/อุปกรณ์สำนักงาน/งานผูกอยู่กับสำนักงานนี้ ระบบจะไม่อนุญาตให้ลบ</span>
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleConfirmDeleteLocation}
                  disabled={deletingLocation}
                  className="glass"
                  style={{
                    flex: 1, padding: '0.75rem', background: 'var(--accent-danger)', color: '#fff', border: 'none',
                    borderRadius: '0.75rem', fontWeight: 700, cursor: deletingLocation ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  {deletingLocation ? <Loader2 size={18} className="animate-spin" /> : 'ใช่, ลบสำนักงาน'}
                </button>
                <button
                  onClick={() => setLocationToDelete(null)}
                  disabled={deletingLocation}
                  className="glass"
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', cursor: 'pointer' }}
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminSettings;
