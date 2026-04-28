import React, { useState, useEffect } from 'react';
import { Users, Shield, Loader2, RefreshCw, Settings, Search, UserPlus, Filter, Trash2, Edit2, ShieldAlert, X, Save, Key, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

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
  
  const isReadOnly = currentUser?.role === 'manager' || currentUser?.role === 'operator';

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
    }
  }, [view]);

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

            {/* System Security Card */}
            <div className="card glass" style={{ padding: '2rem', opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-secondary)' }}>
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="krub-semibold">Security Settings</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>OAuth & API Keys</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Configure backend security protocols and integration secrets.
              </p>
              <button disabled className="glass" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', fontWeight: 600, cursor: 'not-allowed' }}>
                Coming Soon
              </button>
            </div>
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
                      color: '#fff',
                      outline: 'none',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    <option value="10" style={{ background: '#1e293b' }}>10</option>
                    <option value="25" style={{ background: '#1e293b' }}>25</option>
                    <option value="50" style={{ background: '#1e293b' }}>50</option>
                    <option value="100" style={{ background: '#1e293b' }}>100</option>
                  </select>
                </div>
                <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', gap: '0.5rem', minWidth: '250px', borderRadius: '0.5rem' }}>
                  <Search size={18} color="var(--text-secondary)" />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%' }}
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

            <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
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
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
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
                              background: user.role?.includes('admin') ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255,255,255,0.05)',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="glass"
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, color: '#fff' }}
                    >
                      Prev
                    </button>
                    <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="glass"
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, color: '#fff' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.first_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Last Name</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', borderRadius: '0.5rem' }}
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
                        background: 'rgba(22, 20, 50, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: editingUser.role === 'super_admin' ? 'var(--text-secondary)' : '#fff', 
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
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', borderRadius: '0.5rem' }}
                      value={editingUser.pea_branch || ''}
                      onChange={(e) => setEditingUser({...editingUser, pea_branch: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PEA Division</label>
                    <input 
                      type="text" 
                      className="glass"
                      style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', borderRadius: '0.5rem' }}
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
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none' }}
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
                          style={{ width: '100%', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none' }}
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
    </motion.div>
  );
};

export default AdminSettings;
