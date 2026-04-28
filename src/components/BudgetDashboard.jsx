import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { DollarSign, TrendingUp, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Wallet, Target, Loader2, Search, X, FileText, ChevronRight, RotateCcw, ArrowLeft, ChevronLeft, ArrowUpDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { AnimatePresence } from 'framer-motion';

const BudgetDashboard = ({ token }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('summary'); // 'summary' or 'search'
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchSelectors, setSearchSelectors] = useState({
    year: [],
    cost_center: [],
    cost_center_name: [],
    clearing_account: [],
    clearing_account_name: [],
    username: [],
    reference_doc_no: [],
    description: []
  });
  const [searchFormData, setSearchFormData] = useState({
    year: selectedYear,
    cost_center: '',
    clearing_account_name: '',
    username: '',
    reference_doc_no: '',
    description: ''
  });
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'posting_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [visibleLists, setVisibleLists] = useState({
    cost_center: false,
    clearing_account: false,
    username: false,
    reference_doc: false,
    description: false
  });
  const timers = React.useRef({});

  const triggerListVisibility = (field) => {
    // Hide immediately when typing
    setVisibleLists(prev => ({ ...prev, [field]: false }));

    // Clear existing timer for this field
    if (timers.current[field]) clearTimeout(timers.current[field]);

    // Set new timer to show list after 5 seconds
    timers.current[field] = setTimeout(() => {
      setVisibleLists(prev => ({ ...prev, [field]: true }));
    }, 5000);
  };

  useEffect(() => {
    return () => {
      // Cleanup all timers on unmount
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/summary/${selectedYear}`, {
          headers
        });
        const result = await response.json();
        if (result.success) {
          const manualMap = {
            '53032070': 'ค่าInst.Equipสื่อสาร',
            '53032080': 'คชจ.ใช้ Internet',
            '53051060': 'ค่าบำรุงฯ/ซ่อม-IT'
          };
          const mappedData = (result.data || []).map(item => {
            const codeStr = String(item.account_code || '');
            if (manualMap[codeStr]) {
              return { ...item, account_name: manualMap[codeStr] };
            }
            return item;
          });
          setSummaryData(mappedData);
        } else {
          setSummaryData([]);
        }
      } catch (error) {
        console.error('Error fetching budget summary:', error);
        toast.error('Failed to load budget summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedYear, token]);

  const fetchSearchSelectors = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/selectors`, { headers });
      const result = await response.json();
      if (result.success) {
        setSearchSelectors(result.data || {
          year: [],
          cost_center: [],
          cost_center_name: [],
          clearing_account: [],
          clearing_account_name: [],
          username: [],
          reference_doc_no: [],
          description: []
        });
      }
    } catch (error) {
      console.error('Error fetching search selectors:', error);
    }
  };

  useEffect(() => {
    if (showSearchModal) {
      fetchSearchSelectors();
    }
  }, [showSearchModal]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchFormData.year) params.append('year', searchFormData.year);
      if (searchFormData.cost_center) {
        // Manual mapping override for specific cost centers
        const manualMap = {
          '53032070': 'ค่าInst.Equipสื่อสาร',
          '53032080': 'คชจ.ใช้ Internet',
          '53051060': 'ค่าบำรุงฯ/ซ่อม-IT'
        };

        let name = manualMap[searchFormData.cost_center];
        if (!name) {
          // If it's a known code from API, use its name. Otherwise send as is.
          const idx = searchSelectors.cost_center.indexOf(searchFormData.cost_center);
          name = idx !== -1 ? searchSelectors.cost_center_name[idx] : searchFormData.cost_center;
        }
        params.append('cost_center_name', name);
      }
      if (searchFormData.clearing_account_name) {
        params.append('clearing_account_name', searchFormData.clearing_account_name);
      }
      if (searchFormData.username) params.append('username', searchFormData.username);
      if (searchFormData.reference_doc_no) params.append('reference_doc_no', searchFormData.reference_doc_no);
      if (searchFormData.description) params.append('description', searchFormData.description);

      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/find`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const result = await response.json();
      if (result.success) {
        setSearchResults(result.data || []);
        setView('search');
        setCurrentPage(1);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setSearchFormData({
      year: selectedYear,
      cost_center: '',
      clearing_account_name: '',
      username: '',
      reference_doc_no: '',
      description: ''
    });
    setSearchResults(null);
    setTableSearchQuery('');
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredResults = React.useMemo(() => {
    if (!searchResults) return [];
    if (!tableSearchQuery) return searchResults;
    const query = tableSearchQuery.toLowerCase();
    return searchResults.filter(item =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(query)
      )
    );
  }, [searchResults, tableSearchQuery]);

  const sortedResults = React.useMemo(() => {
    const sortableItems = [...filteredResults];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle numeric sorting for amount
        if (sortConfig.key === 'value_co_curr') {
          aVal = parseFloat(aVal || 0);
          bVal = parseFloat(bVal || 0);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredResults, sortConfig]);

  const paginatedResults = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedResults.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedResults, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedResults.length / itemsPerPage);

  const positiveTotal = filteredResults?.reduce((sum, item) => {
    const val = parseFloat(item.value_co_curr || 0);
    return val > 0 ? sum + val : sum;
  }, 0) || 0;

  const negativeTotal = filteredResults?.reduce((sum, item) => {
    const val = parseFloat(item.value_co_curr || 0);
    return val < 0 ? sum + val : sum;
  }, 0) || 0;

  const totalRow = summaryData.find(item => item.account_name && item.account_name.startsWith('รวมทั้งหมด'));
  const listRows = summaryData.filter(item => !item.account_name?.startsWith('รวมทั้งหมด'));

  const stats = totalRow ? [
    { title: 'งบประมาณทั้งหมด', value: `฿${totalRow.budget_allocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: 'Allocated', icon: Wallet, color: '#a855f7' },
    { title: 'งบประมาณที่ใช้ไปแล้ว', value: `฿${totalRow.budget_used.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: `${totalRow.usage_percentage}% Used`, icon: DollarSign, color: '#3b82f6' },
    { title: 'คงเหลือ', value: `฿${totalRow.remaining_budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: `${(100 - totalRow.usage_percentage).toFixed(1)}% Left`, icon: Target, color: totalRow.remaining_budget < 0 ? '#ef4444' : '#10b981' },
    { title: 'งบประมาณที่ใช้ไปแล้ว', value: `฿${(totalRow.budget_used / (new Date().getMonth() + 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: 'YTD Avg', icon: TrendingUp, color: '#f59e0b' },
  ] : [
    { title: 'งบประมาณทั้งหมด', value: '฿0', change: '-', icon: Wallet, color: '#a855f7' },
    { title: 'งบประมาณที่ใช้ไปแล้ว', value: '฿0', change: '-', icon: DollarSign, color: '#3b82f6' },
    { title: 'คงเหลือ', value: '฿0', change: '-', icon: Target, color: '#10b981' },
    { title: 'งบประมาณที่ใช้ไปแล้ว', value: '฿0', change: '-', icon: TrendingUp, color: '#f59e0b' },
  ];

  const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

  // Assign stable colors to categories
  const categoryColorMap = {};
  listRows.forEach((item, index) => {
    categoryColorMap[item.account_name] = colors[index % colors.length];
  });

  const categoryData = listRows.map((item) => ({
    name: item.account_name,
    code: item.account_code,
    value: parseFloat(item.budget_used),
    color: categoryColorMap[item.account_name]
  })).filter(item => item.value > 0);

  const comparisonData = listRows.map(item => ({
    name: item.account_name,
    code: item.account_code,
    allocated: parseFloat(item.budget_allocated),
    spent: parseFloat(item.budget_used),
    color: categoryColorMap[item.account_name]
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="light-theme"
      style={{
        padding: '2rem',
        paddingBottom: '4rem',
        minHeight: 'calc(100vh - 4rem)',
        background: 'var(--bg-color)',
        color: 'var(--text-primary)',
        transition: 'all 0.3s ease',
        borderRadius: '2.5rem',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
      }}
    >
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>การใช้งานงบประมาณที่ได้รับ</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>ตรวจสอบการใช้จ่ายและงบประมาณ แผนกคอมพิวเตอร์และเครือข่าย กดส.ฉ.2</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="glass" style={{ padding: '0.5rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '1.5rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>ปีงบประมาณ:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 700,
                paddingRight: '1.25rem',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
                backgroundSize: '1rem'
              }}
            >
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <button
            onClick={() => {
              setView('search');
              fetchSearchSelectors();
            }}
            className="glass"
            style={{
              padding: '0.6rem 1.8rem',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              borderRadius: '1.5rem',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
            }}
          >
            <Search size={20} />
            <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>ค้นหาข้อมูลการเบิกจ่าย</span>
          </button>
        </div>
      </header>

      {view === 'summary' ? (
        <>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="card glass"
                style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{
                  position: 'absolute', top: '-10%', right: '-10%',
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: stat.color, opacity: 0.05, filter: 'blur(20px)'
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ background: `${stat.color}15`, padding: '0.75rem', borderRadius: '0.75rem', color: stat.color }}>
                    <stat.icon size={24} />
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    color: stat.change.includes('-') ? 'var(--text-secondary)' : stat.title === 'Remaining' ? 'var(--accent-success)' : stat.title === 'Total Budget' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '0.85rem', fontWeight: 600
                  }}>
                    {stat.change}
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{stat.title}</p>
                <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700 }}>
                  {loading ? <Loader2 size={24} className="animate-spin" /> : stat.value}
                </h2>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem', minWidth: 0, minHeight: 0 }}>
            {/* Budget vs Actual Chart */}
            <div className="card glass" style={{ padding: '1.5rem', minWidth: 0, minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={20} color="var(--accent-primary)" /> เปรียบเทียบงบประมาณที่ได้รับและใช้ไปแล้ว
                </h3>
              </div>
              <div style={{ height: '300px', width: '100%', minWidth: 0, minHeight: 0 }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" size={32} color="var(--text-secondary)" /></div>
                ) : comparisonData.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>No data available for {selectedYear}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="rainbowGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="33%" stopColor="#3b82f6" />
                          <stop offset="66%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)' }} />
                      <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="glass" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', background: 'var(--card-bg)' }}>
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{data.name}</p>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Code: {data.code}</p>
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <p style={{ margin: 0, color: data.color, fontSize: '0.85rem' }}>ได้รับ: ฿{data.allocated.toLocaleString()}</p>
                                  <p style={{ margin: 0, color: 'var(--accent-danger)', fontSize: '0.85rem' }}>ใช้แล้ว: ฿{data.spent.toLocaleString()}</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} />
                      <Bar dataKey="allocated" name="งบประมาณที่ได้รับ" fill="url(#rainbowGradient)" radius={[4, 4, 0, 0]} barSize={15}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                      <Bar dataKey="spent" name="งบประมาณที่ใช้ไป" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="card glass" style={{ padding: '1.5rem', minWidth: 0, minHeight: 0 }}>
              <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={20} color="var(--accent-warning)" /> เปรียบเทียบค่าใช้จ่ายตามหมวดหมู่
              </h3>
              <div style={{ height: '300px', width: '100%', minWidth: 0, minHeight: 0 }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" size={32} color="var(--text-secondary)" /></div>
                ) : categoryData.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>No expenditure recorded</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="glass" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', background: 'var(--card-bg)' }}>
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{data.name}</p>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Code: {data.code}</p>
                                <p style={{ margin: '0.5rem 0 0', color: data.color, fontWeight: 700 }}>฿{data.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-cat-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card glass" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>สรุปรายการใช้จ่ายตามรหัสบัญชี</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem' }}>Account Code</th>
                  <th style={{ padding: '1rem' }}>Account Name</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>ได้รับ</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>ใช้แล้ว</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>คงเหลือ</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Usage</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                ) : summaryData.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No summary data available</td></tr>
                ) : (
                  summaryData.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: row.account_name?.startsWith('รวมทั้งหมด') ? 'rgba(0,0,0,0.02)' : 'transparent',
                      fontWeight: row.account_name?.startsWith('รวมทั้งหมด') ? 700 : 400
                    }}>
                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{row.account_code}</td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{row.account_name}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--accent-primary)' }}>฿{parseFloat(row.budget_allocated).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--accent-warning)' }}>฿{parseFloat(row.budget_used).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: parseFloat(row.remaining_budget) < 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>฿{parseFloat(row.remaining_budget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '1rem',
                          background: parseFloat(row.usage_percentage) > 80 ? 'rgba(239, 68, 68, 0.1)' : 'var(--border-color)',
                          color: parseFloat(row.usage_percentage) > 80 ? 'var(--accent-danger)' : 'var(--text-primary)'
                        }}>
                          {row.usage_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Transaction Search View */
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button
              onClick={() => setView('summary')}
              className="glass"
              style={{ padding: '0.6rem', borderRadius: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>ค้นหาข้อมูลการเบิกจ่าย</h2>
          </div>

          <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>ปีงบประมาณ</label>
                <select value={searchFormData.year} onChange={(e) => setSearchFormData({ ...searchFormData, year: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}>
                  <option value="">ทั้งหมด</option>
                  {searchSelectors.year?.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>ศูนย์ต้นทุน (Cost Center)</label>
                <input
                  list="cost-centers"
                  value={searchFormData.cost_center}
                  onChange={(e) => setSearchFormData({ ...searchFormData, cost_center: e.target.value })}
                  className="glass"
                  placeholder="พิมพ์รหัสหรือชื่อ..."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}
                />
                <datalist id="cost-centers">
                  {searchSelectors.cost_center?.map((c, i) => {
                    const manualMap = {
                      '53032070': 'ค่าInst.Equipสื่อสาร',
                      '53032080': 'คชจ.ใช้ Internet',
                      '53051060': 'ค่าบำรุงฯ/ซ่อม-IT'
                    };
                    const name = manualMap[c] || searchSelectors.cost_center_name?.[i];
                    return <option key={i} value={String(c)}>{name}</option>;
                  })}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>ชื่อของบัญชีหักล้าง (Clearing Account)</label>
                <input
                  list={visibleLists.clearing_account ? "clearing-accounts" : ""}
                  value={searchFormData.clearing_account_name}
                  onChange={(e) => {
                    setSearchFormData({ ...searchFormData, clearing_account_name: e.target.value });
                    triggerListVisibility('clearing_account');
                  }}
                  className="glass"
                  placeholder="พิมพ์ชื่อบัญชี..."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}
                />
                <datalist id="clearing-accounts">
                  {searchSelectors.clearing_account_name?.map((name, i) => <option key={i} value={name}>{searchSelectors.clearing_account?.[i]}</option>)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>ชื่อผู้ใช้ (Username)</label>
                <input
                  list={visibleLists.username ? "usernames" : ""}
                  value={searchFormData.username}
                  onChange={(e) => {
                    setSearchFormData({ ...searchFormData, username: e.target.value });
                    triggerListVisibility('username');
                  }}
                  className="glass"
                  placeholder="ระบุชื่อผู้ใช้..."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}
                />
                <datalist id="usernames">
                  {searchSelectors.username?.map((u, i) => <option key={i} value={u} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>เลขที่เอกสาร (Reference Doc)</label>
                <input
                  list={visibleLists.reference_doc ? "ref-docs" : ""}
                  value={searchFormData.reference_doc_no}
                  onChange={(e) => {
                    setSearchFormData({ ...searchFormData, reference_doc_no: e.target.value });
                    triggerListVisibility('reference_doc');
                  }}
                  className="glass"
                  placeholder="ระบุเลขที่เอกสาร..."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}
                />
                <datalist id="ref-docs">
                  {searchSelectors.reference_doc_no?.map((r, i) => <option key={i} value={r} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>รายละเอียด (Description)</label>
                <input
                  list={visibleLists.description ? "descriptions" : ""}
                  value={searchFormData.description}
                  onChange={(e) => {
                    setSearchFormData({ ...searchFormData, description: e.target.value });
                    triggerListVisibility('description');
                  }}
                  className="glass"
                  placeholder="ค้นหาตามรายละเอียด..."
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid rgba(0,0,0,0.15)', color: 'var(--text-primary)', borderRadius: '1.5rem', background: 'var(--card-bg)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.95rem' }}
                />
                <datalist id="descriptions">
                  {searchSelectors.description?.map((d, i) => <option key={i} value={d} />)}
                </datalist>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', gridColumn: 'span 1' }}>
                <button
                  type="submit"
                  disabled={searching}
                  className="glass"
                  style={{ flex: 1, height: '48px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '2rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)' }}
                >
                  {searching ? <Loader2 size={20} className="animate-spin" /> : <><Search size={20} /> ค้นหา</>}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="glass"
                  style={{ height: '48px', padding: '0 1.5rem', borderRadius: '1.5rem', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}
                >
                  <RotateCcw size={20} color="#64748b" /> ล้างข้อมูล
                </button>
              </div>
            </form>
          </div>

          {searchResults && (
            <div className="card glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>ผลการค้นหา ({filteredResults.length} รายการ)</h3>
                  <div style={{ marginTop: '1rem', position: 'relative', width: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      placeholder="ค้นหาภายในตาราง..."
                      value={tableSearchQuery}
                      onChange={(e) => {
                        setTableSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="glass"
                      style={{
                        width: '100%',
                        padding: '0.6rem 1rem 0.6rem 2.5rem',
                        fontSize: '0.9rem',
                        borderRadius: '1.5rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="glass" style={{ padding: '0.75rem 1.25rem', borderRadius: '1.5rem', borderLeft: '5px solid var(--accent-success)', background: 'rgba(16, 185, 129, 0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ยอดรวมเงินเบิกจ่าย</p>
                    <h3 style={{ margin: '0.25rem 0 0', color: 'var(--accent-success)', fontSize: '1.25rem' }}>฿{positiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="glass" style={{ padding: '0.75rem 1.25rem', borderRadius: '1.5rem', borderLeft: '5px solid var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ยอดรวมไม่เบิกจ่าย</p>
                    <h3 style={{ margin: '0.25rem 0 0', color: 'var(--accent-danger)', fontSize: '1.25rem' }}>฿{Math.abs(negativeTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="glass" style={{ padding: '0.75rem 1.25rem', borderRadius: '1.5rem', borderLeft: '5px solid var(--accent-primary)', background: 'rgba(168, 85, 247, 0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ยอดเบิกจ่ายทั้งหมด</p>
                    <h3 style={{ margin: '0.25rem 0 0', color: 'var(--accent-primary)', fontSize: '1.25rem' }}>฿{(positiveTotal + negativeTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '1.5rem', background: 'var(--card-bg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '2px solid var(--border-color)' }}>
                    <tr>
                      {[
                        { label: 'Doc / Posting Date', key: 'document_date' },
                        { label: 'เลขที่เอกสาร', key: 'reference_doc_no' },
                        { label: 'รายละเอียด', key: 'description' },
                        { label: 'เลขที่บัญชี', key: 'cost_center' },
                        { label: 'ชื่อผู้ใช้', key: 'username' },
                        { label: 'ปี', key: 'year' },
                        { label: 'บัญชีหักล้าง', key: 'clearing_account_name' },
                        { label: 'จำนวนเงิน', key: 'value_co_curr', align: 'right' }
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => requestSort(col.key)}
                          style={{ padding: '1.25rem 1rem', textAlign: col.align || 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start', gap: '0.5rem' }}>
                            {col.label}
                            <ArrowUpDown size={14} style={{ opacity: sortConfig.key === col.key ? 1 : 0.3, color: sortConfig.key === col.key ? 'var(--accent-primary)' : 'inherit' }} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.length === 0 ? (
                      <tr><td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>ไม่พบข้อมูลตามเงื่อนไขที่ระบุ</td></tr>
                    ) : (
                      paginatedResults.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="hover:bg-slate-50/50">
                          <td style={{ padding: '1.25rem 1rem' }}>
                            <div style={{ fontWeight: 700 }}>{item.document_date}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.posting_date}</div>
                          </td>
                          <td style={{ padding: '1.25rem 1rem', fontWeight: 500 }}>{item.reference_doc_no}</td>
                          <td style={{ padding: '1.25rem 1rem', maxWidth: '300px', lineHeight: '1.4' }}>{item.description}</td>
                          <td style={{ padding: '1.25rem 1rem' }}>
                            <div style={{ fontWeight: 600 }}>{item.cost_center}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cost_center_name}</div>
                          </td>
                          <td style={{ padding: '1.25rem 1rem' }}>{item.username}</td>
                          <td style={{ padding: '1.25rem 1rem' }}>{item.year}</td>
                          <td style={{ padding: '1.25rem 1rem', color: 'var(--text-secondary)' }}>{item.clearing_account_name}</td>
                          <td style={{ padding: '1.25rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                            ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                    แสดง {Math.min(filteredResults.length, (currentPage - 1) * itemsPerPage + 1)} ถึง {Math.min(filteredResults.length, currentPage * itemsPerPage)} จากทั้งหมด {filteredResults.length} รายการ
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>แถวต่อหน้า:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '0.6rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {[10, 15, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      style={{ width: '40px', height: '40px', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 2 + i;
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                          if (pageNum < 1) pageNum = i + 1;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: '40px', height: '40px', borderRadius: '0.75rem', border: '1px solid var(--border-color)',
                              background: currentPage === pageNum ? 'var(--accent-primary)' : 'var(--card-bg)',
                              color: currentPage === pageNum ? '#fff' : 'var(--text-primary)',
                              fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      style={{ width: '40px', height: '40px', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default BudgetDashboard;
