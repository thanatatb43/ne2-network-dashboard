import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Loader2, Edit2, Trash2, Plus, Save,
  AlertTriangle, ChevronLeft, ChevronRight, Search,
  ArrowUpDown, ArrowUp, ArrowDown, Wallet, X, Upload, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BudgetManagement = ({ token, onBack, user }) => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    cost_center_group: '',
    account_code: '',
    account_name: '',
    budget_used: '',
    budget_allocated: '',
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    period: (new Date().getMonth() + 1).toString(),
    day: ''
  });
  const [selectors, setSelectors] = useState({
    cost_center_groups: [],
    account_codes: [],
    account_names: [],
    accounts_mapped: [],
    years: []
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [responseModal, setResponseModal] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    file: null,
    cost_center: '53051060',
    year: new Date().getFullYear().toString()
  });

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('budgets'); // 'budgets' or 'transactions'
  const [uploadResult, setUploadResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Permissions logic
  const isSuperAdmin = user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const canAdd = isSuperAdmin || isOperator;
  const canEdit = isSuperAdmin || isOperator;
  const canDelete = isSuperAdmin;

  const [showFormModal, setShowFormModal] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setBudgets(result.data || []);
      } else {
        setBudgets(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectors = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/selectors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setSelectors({
          cost_center_groups: result.data.cost_center_groups || [],
          account_codes: result.data.account_codes || [],
          account_names: result.data.account_names || [],
          accounts_mapped: result.data.accounts_mapped || [],
          years: result.data.years || []
        });
      }
    } catch (error) {
      console.error('Error fetching selectors:', error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setTransactions(result.data || []);
      } else {
        setTransactions(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'budgets') {
      fetchBudgets();
    } else {
      fetchTransactions();
    }
    fetchSelectors();
  }, [activeSubTab]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredBudgets = budgets.filter(item => {
    const search = searchTerm.toLowerCase();
    return (
      item.account_name?.toLowerCase().includes(search) ||
      item.account_code?.toLowerCase().includes(search) ||
      item.cost_center_group?.toLowerCase().includes(search) ||
      item.year?.toString().includes(search)
    );
  });

  const filteredTransactions = transactions.filter(item => {
    const search = searchTerm.toLowerCase();
    return (
      item.description?.toLowerCase().includes(search) ||
      item.reference_doc_no?.toLowerCase().includes(search) ||
      item.cost_center?.toLowerCase().includes(search) ||
      item.clearing_account_name?.toLowerCase().includes(search) ||
      item.username?.toLowerCase().includes(search) ||
      item.posting_date?.toLowerCase().includes(search)
    );
  });

  const sortedBudgets = [...filteredBudgets].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    // Numeric sort for count and value_co_curr
    if (sortConfig.key === 'count' || sortConfig.key === 'value_co_curr') {
      const nA = parseFloat(aVal || 0);
      const nB = parseFloat(bVal || 0);
      return sortConfig.direction === 'asc' ? nA - nB : nB - nA;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentItems = activeSubTab === 'budgets'
    ? sortedBudgets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : sortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = Math.ceil((activeSubTab === 'budgets' ? sortedBudgets.length : sortedTransactions.length) / itemsPerPage);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // Auto-fill account_name if account_code is mapped
      if (name === 'account_code') {
        const mapping = selectors.accounts_mapped.find(m => m.account_code === value);
        if (mapping) {
          newData.account_name = mapping.account_name;
        }
      }
      return newData;
    });
  };

  const resetForm = () => {
    setFormData({
      cost_center_group: '',
      account_code: '',
      account_name: '',
      budget_used: '',
      budget_allocated: '',
      year: new Date().getFullYear().toString(),
      month: (new Date().getMonth() + 1).toString(),
      period: (new Date().getMonth() + 1).toString(),
      day: ''
    });
    setEditingBudget(null);
    setShowFormModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const url = editingBudget
      ? `${API_URL}/api/budgets/${editingBudget.id}`
      : `${API_URL}/api/budgets`;

    const method = editingBudget ? 'PUT' : 'POST';

    // Build URLSearchParams as requested (qs.stringify equivalent)
    const params = new URLSearchParams();
    Object.keys(formData).forEach(key => {
      params.append(key, formData[key]);
    });

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const result = await response.json();
      if (result.success || response.ok) {
        toast.success(editingBudget ? 'Budget updated successfully' : 'Budget added successfully');
        resetForm();
        fetchBudgets();
      } else {
        toast.error(result.message || 'Failed to save budget');
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Network error while saving budget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!budgetToDelete) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/${budgetToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success || response.ok) {
        toast.success('Budget deleted successfully');
        setBudgetToDelete(null);
        fetchBudgets();
      } else {
        toast.error(result.message || 'Failed to delete budget');
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast.error('Network error while deleting budget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();

    if (!uploadFormData.file) {
      toast.error('กรุณาเลือกไฟล์ที่ต้องการอัพโหลด');
      return;
    }

    const fileSizeLimit = 100 * 1024 * 1024; // 100MB
    if (uploadFormData.file.size > fileSizeLimit) {
      toast.error('ไฟล์มีขนาดใหญ่เกิน 100MB');
      return;
    }

    setActionLoading(true);
    const data = new FormData();
    data.append('file', uploadFormData.file);
    data.append('cost_center', uploadFormData.cost_center);
    data.append('year', uploadFormData.year);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/upload-transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      const result = await response.json();
      if (result.success || response.ok) {
        toast.success('อัพโหลดข้อมูลสำเร็จ');
        setShowUploadModal(false);
        setUploadResult(result);
        setShowResultModal(true);
        setUploadFormData({ file: null, cost_center: '53051060', year: new Date().getFullYear().toString() });
        if (activeSubTab === 'budgets') {
          fetchBudgets();
        } else {
          fetchTransactions();
        }
      } else {
        toast.error(result.message || 'เกิดข้อผิดพลาดในการอัพโหลด');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Network error during upload');
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({
      cost_center_group: budget.cost_center_group || '',
      account_code: budget.account_code || '',
      account_name: budget.account_name || '',
      budget_used: budget.budget_used || '',
      budget_allocated: budget.budget_allocated || '',
      year: budget.year?.toString() || '',
      month: budget.month?.toString() || '',
      period: budget.period?.toString() || '',
      day: budget.day || ''
    });
    setShowFormModal(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} className="glass" style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} /> กลับ
        </button>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>จัดการงบประมาณและข้อมูลการเบิกจ่าย</h2>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 0.5rem' }}>
        <button
          onClick={() => { setActiveSubTab('budgets'); setCurrentPage(1); setSearchTerm(''); }}
          style={{
            padding: '0.75rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
            color: activeSubTab === 'budgets' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'budgets' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.3s'
          }}
        >
          งบประมาณ (Budgets)
        </button>
        <button
          onClick={() => { setActiveSubTab('transactions'); setCurrentPage(1); setSearchTerm(''); }}
          style={{
            padding: '0.75rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
            color: activeSubTab === 'transactions' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeSubTab === 'transactions' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.3s'
          }}
        >
          ข้อมูลการเบิกจ่าย (Transactions)
        </button>
      </div>

      {/* Data Table Container */}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
              <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: '#1e293b' }}>{v}</option>)}
                <option value={999999} style={{ background: '#1e293b' }}>All</option>
              </select>
            </div>
            {canAdd && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {activeSubTab === 'budgets' ? (
                  <button
                    onClick={() => { resetForm(); setShowFormModal(true); }}
                    className="glass"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1rem', background: 'var(--accent-primary)',
                      border: 'none', color: '#fff', borderRadius: '0.5rem',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Plus size={18} /> เพิ่มงบประมาณ
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="glass"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1rem', background: 'var(--accent-primary)',
                      border: 'none', color: '#fff', borderRadius: '0.5rem',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Upload size={18} /> อัพโหลดข้อมูลการเบิกจ่ายงบ
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={activeSubTab === 'budgets' ? "Search budgets..." : "Search transactions..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {activeSubTab === 'budgets' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th onClick={() => handleSort('year')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ปี {sortConfig.key === 'year' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th style={{ padding: '1rem 1.5rem' }}>Period</th>
                  <th style={{ padding: '1rem 1.5rem' }}>วันที่ (Date)</th>
                  <th style={{ padding: '1rem 1.5rem' }}>Cost Center Group</th>
                  <th style={{ padding: '1rem 1.5rem' }}>รหัสบัญชี</th>
                  <th style={{ padding: '1rem 1.5rem' }}>ชื่อบัญชี</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>งบประมาณที่ได้รับ</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>งบประมาณที่ใช้ไป</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>คงเหลือ</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /><p style={{ marginTop: '1rem' }}>Loading budgets...</p></td></tr>
                ) : currentItems.length === 0 ? (
                  <tr><td colSpan="10" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>ไม่พบข้อมูลรายจ่าย</td></tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                      <td style={{ padding: '1rem 1.5rem' }}>{item.year}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{item.period || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {item.year}-{String(item.month).padStart(2, '0')}-{String(item.day || '01').padStart(2, '0')}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>{item.cost_center_group}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{item.account_code}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{item.account_name}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--accent-success)', fontWeight: 600 }}>
                        ฿{parseFloat(item.budget_allocated || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--accent-warning)', fontWeight: 600 }}>
                        ฿{parseFloat(item.budget_used || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{
                          fontWeight: 700,
                          color: (parseFloat(item.budget_allocated || 0) - parseFloat(item.budget_used || 0)) < 0 ? 'var(--accent-danger)' : 'var(--accent-primary)'
                        }}>
                          ฿{(parseFloat(item.budget_allocated || 0) - parseFloat(item.budget_used || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {parseFloat(item.budget_allocated || 0) > 0
                            ? (((parseFloat(item.budget_allocated) - parseFloat(item.budget_used)) / parseFloat(item.budget_allocated)) * 100).toFixed(1)
                            : '0.0'}% remaining
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => startEdit(item)} disabled={!canEdit} className="glass" style={{ padding: '0.4rem', border: 'none', color: 'var(--text-secondary)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.3 }} title="Edit"><Edit2 size={14} /></button>
                          <button onClick={() => setBudgetToDelete(item)} disabled={!canDelete} className="glass" style={{ padding: '0.4rem', border: 'none', color: 'var(--accent-danger)', cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.3 }} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th onClick={() => handleSort('count')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ลำดับ {sortConfig.key === 'count' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('posting_date')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Postg Date {sortConfig.key === 'posting_date' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('reference_doc_no')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Reference Doc No {sortConfig.key === 'reference_doc_no' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('description')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>รายละเอียด {sortConfig.key === 'description' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('cost_center')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>รหัสบัญชี {sortConfig.key === 'cost_center' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('clearing_account_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ชื่อของบัญชีหักล้าง {sortConfig.key === 'clearing_account_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('username')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ชื่อผู้ใช้ {sortConfig.key === 'username' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                  <th onClick={() => handleSort('value_co_curr')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>จำนวนเงิน {sortConfig.key === 'value_co_curr' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /><p style={{ marginTop: '1rem' }}>Loading transactions...</p></td></tr>
                ) : currentItems.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>ไม่พบข้อมูลการเบิกจ่าย</td></tr>
                ) : (
                  currentItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.count || idx + 1}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.posting_date || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.reference_doc_no || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.description || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.cost_center || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.clearing_account_name || '-'}</td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.username || '-'}</td>
                      <td style={{
                        padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 600,
                        color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)'
                      }}>
                        ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, (activeSubTab === 'budgets' ? sortedBudgets.length : sortedTransactions.length))} of {(activeSubTab === 'budgets' ? sortedBudgets.length : sortedTransactions.length)} entries</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="glass"
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p} style={{ background: '#1e293b' }}>Page {p} of {totalPages}</option>
                ))}
              </select>

              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === totalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showFormModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card glass" style={{ maxWidth: '650px', width: '100%', padding: '2rem', position: 'relative' }}>
              <button onClick={resetForm} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)' }}>
                  {editingBudget ? <Edit2 size={24} /> : <Plus size={24} />}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{editingBudget ? 'แก้ไขข้อมูลงบประมาณ' : 'เพิ่มข้อมูลงบประมาณใหม่'}</h3>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>กลุ่มศูนย์ต้นทุน</label>
                  <input type="text" list="cost_center_groups" name="cost_center_group" value={formData.cost_center_group} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                  <datalist id="cost_center_groups">
                    {selectors.cost_center_groups.map(g => <option key={g} value={g} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Account Code (ส่วนประกอบต้นทุน)</label>
                  <input type="text" list="account_codes" name="account_code" value={formData.account_code} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                  <datalist id="account_codes">
                    {selectors.account_codes.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Account Name</label>
                  <input type="text" list="account_names" name="account_name" value={formData.account_name} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                  <datalist id="account_names">
                    {selectors.account_names.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Budget Used (ต้นทุนจริง)</label>
                  <input type="number" step="0.01" name="budget_used" value={formData.budget_used} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Budget Allocated (ต/ทตามแผน)</label>
                  <input type="number" step="0.01" name="budget_allocated" value={formData.budget_allocated} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Year</label>
                  <input type="text" list="years" name="year" value={formData.year} onChange={handleInputChange} required className="glass" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                  <datalist id="years">
                    {selectors.years.map(y => <option key={y} value={y} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Month / Period</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" name="month" placeholder="Month" value={formData.month} onChange={handleInputChange} required className="glass" style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                    <input type="text" name="period" placeholder="Period" value={formData.period} onChange={handleInputChange} required className="glass" style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', gridColumn: 'span 2', marginTop: '1rem' }}>
                  <button type="submit" disabled={actionLoading} className="glass" style={{ flex: 1, padding: '1rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> {editingBudget ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูลงบประมาณ'}</>}
                  </button>
                  <button type="button" onClick={resetForm} className="glass" style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}>ยกเลิก</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {budgetToDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card glass" style={{ maxWidth: '400px', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}><Trash2 size={32} /></div>
              <h2 style={{ margin: '0 0 1rem' }}>ยืนยันการลบข้อมูล</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>คุณต้องการลบข้อมูลบัญชี "{budgetToDelete.account_name}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={handleDelete} disabled={actionLoading} className="glass" style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-danger)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>{actionLoading ? <Loader2 size={18} className="animate-spin" /> : 'ใช่, ลบข้อมูล'}</button>
                <button onClick={() => setBudgetToDelete(null)} className="glass" style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}>ยกเลิก</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Transactions Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card glass" style={{ maxWidth: '500px', width: '100%', padding: '2rem', position: 'relative' }}>
              <button onClick={() => setShowUploadModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-primary)' }}>
                  <Upload size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>อัพโหลดข้อมูลการเบิกจ่ายงบ</h3>
              </div>

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>ปีงบประมาณ (Year)</label>
                  <select
                    value={uploadFormData.year}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, year: e.target.value })}
                    className="glass"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none' }}
                  >
                    {Array.from({ length: new Date().getFullYear() - 2023 + 1 }, (_, i) => 2023 + i).map(y => (
                      <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>รหัสบัญชี</label>
                  <select
                    value={uploadFormData.cost_center}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, cost_center: e.target.value })}
                    className="glass"
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0.5rem', outline: 'none' }}
                  >
                    <option value="53051060" style={{ background: '#1e293b' }}>53051060 ค่าบำรุงฯ/ซ่อม-IT</option>
                    <option value="53032070" style={{ background: '#1e293b' }}>53032070 ค่าInst.Equipสื่อ</option>
                    <option value="53032080" style={{ background: '#1e293b' }}>53032080 คชจ.ใช้ Internet</option>
                  </select>
                </div>

                <div
                  style={{
                    border: '2px dashed rgba(255,255,255,0.1)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    background: uploadFormData.file ? 'rgba(168, 85, 247, 0.05)' : 'transparent'
                  }}
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx, .csv, .xls"
                    style={{ display: 'none' }}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, file: e.target.files[0] })}
                  />
                  <FileText size={32} style={{ margin: '0 auto 1rem', color: uploadFormData.file ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                  {uploadFormData.file ? (
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>{uploadFormData.file.name}</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(uploadFormData.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFormData({ ...uploadFormData, file: null });
                          const input = document.getElementById('file-upload');
                          if (input) input.value = '';
                        }}
                        className="glass"
                        style={{
                          marginTop: '1rem',
                          padding: '0.4rem 1rem',
                          border: 'none',
                          color: 'var(--accent-danger)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          margin: '1rem auto 0',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <X size={14} /> ล้างค่า (Clear)
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0 }}>คลิกเพื่อเลือกไฟล์</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>รองรับไฟล์ .xlsx, .csv, .xls (สูงสุด 100MB)</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#f10b0bff' }}>กรุณาตรวจสอบไฟล์ที่อัพโหลดจะต้องตัดส่วนที่ไม่ใช่หัว Column และส่วนท้ายที่ไม่ใช่ข้อมูล และปีงบประมาณ, รหัสบัญชีที่เลือกจะต้องตรงกับไฟล์ที่จะอัพโหลด</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!uploadFormData.file) {
                        toast.error('กรุณาเลือกไฟล์ที่ต้องการอัพโหลด');
                        return;
                      }
                      setShowUploadConfirm(true);
                    }}
                    disabled={actionLoading || !uploadFormData.file}
                    className="glass"
                    style={{ flex: 1, padding: '1rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: (actionLoading || !uploadFormData.file) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: (actionLoading || !uploadFormData.file) ? 0.5 : 1 }}
                  >
                    {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <><Upload size={18} /> เริ่มอัพโหลด</>}
                  </button>
                  <button type="button" onClick={() => setShowUploadModal(false)} className="glass" style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}>ยกเลิก</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Confirmation Modal */}
      <AnimatePresence>
        {showUploadConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card glass" style={{ maxWidth: '450px', width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}><AlertTriangle size={32} /></div>
              <h2 style={{ margin: '0 0 1rem' }}>ยืนยันการอัพโหลดข้อมูล</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
                ตรวจสอบข้อมูลถูกต้อง<br />
                รหัสบัญชี <strong>{uploadFormData.cost_center}</strong> ของปี <strong>{uploadFormData.year}</strong><br />
                จะถูกล้างและแทนที่ด้วยข้อมูลใหม่
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setShowUploadConfirm(false);
                    handleUpload();
                  }}
                  disabled={actionLoading}
                  className="glass"
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : 'ยืนยันอัพโหลด'}
                </button>
                <button
                  onClick={() => setShowUploadConfirm(false)}
                  className="glass"
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Result Modal */}
      <AnimatePresence>
        {showResultModal && uploadResult && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card glass" style={{ maxWidth: '800px', width: '100%', padding: '2rem', position: 'relative' }}>
              <button onClick={() => setShowResultModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--accent-success)' }}>
                  <FileText size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.5rem' }}>ผลการอัพโหลดข้อมูล</h3>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>จำนวนแถวที่ประมวลผล</p>
                    <h2 style={{ margin: '0.25rem 0 0', color: 'var(--accent-primary)' }}>{uploadResult.count || uploadResult.total_rows || (uploadResult.data ? uploadResult.data.length : 0)}</h2>
                  </div>
                  <div className="glass" style={{ padding: '1rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>สถานะ</p>
                    <h2 style={{ margin: '0.25rem 0 0', color: 'var(--accent-success)' }}>สำเร็จ</h2>
                  </div>
                </div>

                {uploadResult.data && Array.isArray(uploadResult.data) && uploadResult.data.length > 0 && (
                  <div>
                    <p style={{ marginBottom: '0.75rem', fontWeight: 600 }}>ข้อมูลที่อัพโหลด:</p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#1e293b' }}>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Postg Date</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Reference No</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadResult.data.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '0.5rem' }}>{item.posting_date || '-'}</td>
                              <td style={{ padding: '0.5rem' }}>{item.reference_doc_no || '-'}</td>
                              <td style={{ padding: '0.5rem' }}>{item.description || '-'}</td>
                              <td style={{
                                padding: '0.5rem', textAlign: 'right',
                                color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'inherit'
                              }}>
                                ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowResultModal(false)} className="glass" style={{ width: '100%', padding: '1rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                ตกลง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BudgetManagement;
