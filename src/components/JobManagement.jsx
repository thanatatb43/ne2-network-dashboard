import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, Search,
  ArrowUpDown, ArrowUp, ArrowDown, ClipboardList, Wallet, FileText, Activity,
  Plus, X, CheckSquare, Square, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const JobManagement = ({ token, onBack, user }) => {
  // ----------------------------------------------------
  // STATE 1: Global Jobs List
  // ----------------------------------------------------
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  // ----------------------------------------------------
  // STATE 2: Site-Specific View
  // ----------------------------------------------------
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [selectedSiteProvince, setSelectedSiteProvince] = useState('');
  const [siteJobs, setSiteJobs] = useState([]);
  const [loadingSite, setLoadingSite] = useState(false);
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  const [siteCurrentPage, setSiteCurrentPage] = useState(1);
  const [siteItemsPerPage, setSiteItemsPerPage] = useState(10);
  const [siteSortConfig, setSiteSortConfig] = useState({ key: 'posting_date', direction: 'desc' });

  // ----------------------------------------------------
  // STATE 3: Job-Specific View
  // ----------------------------------------------------
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [jobCurrentPage, setJobCurrentPage] = useState(1);
  const [jobItemsPerPage, setJobItemsPerPage] = useState(10);
  const [jobSortConfig, setJobSortConfig] = useState({ key: 'posting_date', direction: 'desc' });

  // ----------------------------------------------------
  // STATE 4: Create Job Modal
  // ----------------------------------------------------
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  
  // Create Job Form fields
  const [newJobName, setNewJobName] = useState('');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState([]);

  // Transaction Lookup in Modal
  const [txYear, setTxYear] = useState(new Date().getFullYear().toString());
  const [txCostCenterName, setTxCostCenterName] = useState('');
  const [txClearingAccount, setTxClearingAccount] = useState('');
  const [txClearingAccountName, setTxClearingAccountName] = useState('');
  const [txUsername, setTxUsername] = useState('');
  const [txReferenceDocNo, setTxReferenceDocNo] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [loadingTxSearch, setLoadingTxSearch] = useState(false);
  const [searchedTransactions, setSearchedTransactions] = useState([]);
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

  // ----------------------------------------------------
  // API FETCH: All Jobs
  // ----------------------------------------------------
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setJobs(result.data || []);
      } else {
        setJobs(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('ไม่สามารถโหลดข้อมูลงานได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Fetch PEA sites from pea-jobs/sites endpoint
  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      const list = result.data || result || [];
      // Deduplicate or map unique sites by pea_name
      setSites(list);
      if (list.length > 0 && !selectedSite) {
        setSelectedSite(list[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('ไม่สามารถโหลดรายชื่อสาขา PEA ได้');
    } finally {
      setLoadingSites(false);
    }
  };

  const fetchSearchSelectors = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/selectors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setSearchSelectors({
          year: [],
          cost_center: [],
          cost_center_name: result.data?.cost_center_name || [],
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
    if (showCreateModal) {
      fetchSites();
      fetchSearchSelectors();
      // Reset form on open
      setNewJobName('');
      setNewJobDesc('');
      setSelectedTxIds([]);
      setSearchedTransactions([]);
      setTxYear(new Date().getFullYear().toString());
      setTxCostCenterName('');
      setTxClearingAccount('');
      setTxClearingAccountName('');
      setTxUsername('');
      setTxReferenceDocNo('');
      setTxDescription('');
    }
  }, [showCreateModal]);

  // Lookup Transactions from /api/budgets/transactions/find
  const handleLookupTransactions = async () => {
    setLoadingTxSearch(true);
    try {
      const params = new URLSearchParams();
      if (txYear) params.append('year', txYear);
      if (txCostCenterName) params.append('cost_center_name', txCostCenterName);
      if (txClearingAccount) params.append('clearing_account', txClearingAccount);
      if (txClearingAccountName) params.append('clearing_account_name', txClearingAccountName);
      if (txUsername) params.append('username', txUsername);
      if (txReferenceDocNo) params.append('reference_doc_no', txReferenceDocNo);
      if (txDescription) params.append('description', txDescription);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/find`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const result = await response.json();
      if (result.success) {
        setSearchedTransactions(result.data || []);
        if ((result.data || []).length === 0) {
          toast.error('ไม่พบรายการธุรกรรมที่ค้นหา');
        }
      } else {
        setSearchedTransactions([]);
        toast.error('ไม่พบรายการธุรกรรมที่ค้นหา');
      }
    } catch (error) {
      console.error('Error finding transactions:', error);
      toast.error('เกิดข้อผิดพลาดในการค้นหาธุรกรรม');
    } finally {
      setLoadingTxSearch(false);
    }
  };

  // Toggle transaction selection
  const handleToggleTx = (id) => {
    if (selectedTxIds.includes(id)) {
      setSelectedTxIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedTxIds(prev => [...prev, id]);
    }
  };

  // Submit Create PEA Job
  const handleCreateJobSubmit = async (e) => {
    e.preventDefault();
    if (!newJobName.trim()) {
      toast.error('กรุณาระบุชื่องาน');
      return;
    }
    if (!selectedSite) {
      toast.error('กรุณาเลือกสาขา PEA');
      return;
    }

    setCreateSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.append('pea_site_id', selectedSite);
      params.append('job_name', newJobName);
      params.append('job_description', newJobDesc);
      selectedTxIds.forEach(id => {
        params.append('budget_transaction_ids[]', id.toString());
      });

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      const result = await response.json();
      if (response.ok || result.success) {
        toast.success(result.message || 'สร้างงานและเชื่อมโยงธุรกรรมสำเร็จ');
        setShowCreateModal(false);
        fetchJobs();
      } else {
        toast.error(result.message || result.error || 'ไม่สามารถบันทึกข้อมูลงานได้');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // HANDLERS & FILTERS: Global Jobs Sorting
  // ----------------------------------------------------
  const handleSortConfig = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSiteClick = async (siteId, siteName, siteProvince) => {
    setSelectedSiteId(siteId);
    setSelectedSiteName(siteName);
    setSelectedSiteProvince(siteProvince);
    setLoadingSite(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/site/${siteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setSiteJobs(result.data || []);
      } else {
        setSiteJobs(result || []);
      }
    } catch (error) {
      console.error('Error fetching site jobs:', error);
      toast.error('ไม่สามารถโหลดข้อมูลงานของสาขานี้ได้');
    } finally {
      setLoadingSite(false);
    }
  };

  const handleJobClick = async (jobId) => {
    setSelectedJobId(jobId);
    setLoadingJob(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setJobDetails(result.data || result);
      } else {
        setJobDetails(result);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('ไม่สามารถโหลดรายละเอียดของงานนี้ได้');
    } finally {
      setLoadingJob(false);
    }
  };

  const handleSiteSort = (key) => {
    let direction = 'asc';
    if (siteSortConfig.key === key && siteSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSiteSortConfig({ key, direction });
  };

  const handleJobSort = (key) => {
    let direction = 'asc';
    if (jobSortConfig.key === key && jobSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setJobSortConfig({ key, direction });
  };

  const filteredJobsList = jobs.filter(item => {
    const search = searchTerm.toLowerCase();
    return (
      item.job_name?.toLowerCase().includes(search) ||
      item.job_description?.toLowerCase().includes(search) ||
      item.pea_site?.pea_name?.toLowerCase().includes(search) ||
      item.pea_site?.pea_province?.toLowerCase().includes(search) ||
      item.id?.toString().includes(search)
    );
  });

  const sortedJobsList = [...filteredJobsList].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let aVal, bVal;
    if (sortConfig.key === 'pea_name') {
      aVal = a.pea_site?.pea_name || '';
      bVal = b.pea_site?.pea_name || '';
    } else if (sortConfig.key === 'pea_province') {
      aVal = a.pea_site?.pea_province || '';
      bVal = b.pea_site?.pea_province || '';
    } else if (sortConfig.key === 'transactions') {
      aVal = a.transactions?.length || 0;
      bVal = b.transactions?.length || 0;
    } else {
      aVal = a[sortConfig.key];
      bVal = b[sortConfig.key];
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentItemsList = sortedJobsList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPagesList = Math.ceil(sortedJobsList.length / itemsPerPage);

  // ----------------------------------------------------
  // HANDLERS & FILTERS: Site Specific View
  // ----------------------------------------------------
  const siteTransactionsList = React.useMemo(() => {
    const list = [];
    siteJobs.forEach(job => {
      if (Array.isArray(job.transactions)) {
        job.transactions.forEach(t => {
          list.push({
            ...t,
            job_name: job.job_name,
            job_description: job.job_description
          });
        });
      }
    });
    return list;
  }, [siteJobs]);

  const filteredSiteTransactionsList = siteTransactionsList.filter(t => {
    const search = siteSearchTerm.toLowerCase();
    return (
      t.job_name?.toLowerCase().includes(search) ||
      t.reference_doc_no?.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.clearing_account_name?.toLowerCase().includes(search) ||
      t.cost_center?.toLowerCase().includes(search) ||
      t.username?.toLowerCase().includes(search)
    );
  });

  const sortedSiteTransactionsList = [...filteredSiteTransactionsList].sort((a, b) => {
    if (!siteSortConfig.key) return 0;
    
    let aVal = a[siteSortConfig.key];
    let bVal = b[siteSortConfig.key];

    if (siteSortConfig.key === 'value_co_curr') {
      const nA = parseFloat(aVal || 0);
      const nB = parseFloat(bVal || 0);
      return siteSortConfig.direction === 'asc' ? nA - nB : nB - nA;
    }

    if (aVal < bVal) return siteSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return siteSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentSiteItemsList = sortedSiteTransactionsList.slice((siteCurrentPage - 1) * siteItemsPerPage, siteCurrentPage * siteItemsPerPage);
  const totalSitePagesList = Math.ceil(sortedSiteTransactionsList.length / siteItemsPerPage);

  const totalSiteSpendingList = React.useMemo(() => {
    return siteTransactionsList.reduce((sum, t) => sum + parseFloat(t.value_co_curr || 0), 0);
  }, [siteTransactionsList]);

  // ----------------------------------------------------
  // HANDLERS & FILTERS: Job Specific View (id call)
  // ----------------------------------------------------
  const filteredJobTransactionsList = (jobDetails?.transactions || []).filter(t => {
    const search = jobSearchTerm.toLowerCase();
    return (
      t.reference_doc_no?.toLowerCase().includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.clearing_account_name?.toLowerCase().includes(search) ||
      t.cost_center?.toLowerCase().includes(search) ||
      t.username?.toLowerCase().includes(search)
    );
  });

  const sortedJobTransactionsList = [...filteredJobTransactionsList].sort((a, b) => {
    if (!jobSortConfig.key) return 0;
    
    let aVal = a[jobSortConfig.key];
    let bVal = b[jobSortConfig.key];

    if (jobSortConfig.key === 'value_co_curr') {
      const nA = parseFloat(aVal || 0);
      const nB = parseFloat(bVal || 0);
      return jobSortConfig.direction === 'asc' ? nA - nB : nB - nA;
    }

    if (aVal < bVal) return jobSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return jobSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const currentJobItemsList = sortedJobTransactionsList.slice((jobCurrentPage - 1) * jobItemsPerPage, jobCurrentPage * jobItemsPerPage);
  const totalJobPagesList = Math.ceil(sortedJobTransactionsList.length / jobItemsPerPage);

  const totalJobSpendingList = React.useMemo(() => {
    return (jobDetails?.transactions || []).reduce((sum, t) => sum + parseFloat(t.value_co_curr || 0), 0);
  }, [jobDetails]);

  // Can user edit/add jobs? (Usually super_admin, network_admin or operator roles)
  const canCreate = user?.role === 'super_admin' || user?.role === 'network_admin' || user?.role === 'operator';

  // ----------------------------------------------------
  // RENDER JSX
  // ----------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <AnimatePresence mode="wait">
        {/* VIEW 3: Job-Specific Details View */}
        {selectedJobId ? (
          <motion.div
            key="job_details_view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => { setSelectedJobId(null); setJobDetails(null); }}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง รายการงานทั้งหมด
              </button>
            </div>

            {loadingJob ? (
              <div className="card glass" style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-warning)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดรายละเอียดข้อมูลงาน...</p>
              </div>
            ) : !jobDetails ? (
              <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                ไม่พบรายละเอียดข้อมูลงานนี้
              </div>
            ) : (
              <>
                {/* Summary cards for this job */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ชื่องาน / รายละเอียด</span>
                      <div style={{ color: 'var(--accent-primary)', background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <ClipboardList size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobDetails.job_name}>
                        {jobDetails.job_name}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{jobDetails.job_description || '-'}</p>
                    </div>
                  </div>

                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>สถานที่ / สาขา</span>
                      <div style={{ color: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Activity size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block' }}>
                        {jobDetails.pea_site?.pea_name || '-'}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>จังหวัด: {jobDetails.pea_site?.pea_province || '-'}</p>
                    </div>
                  </div>

                  <div className="card glass" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ค่าใช้จ่ายเฉพาะงานนี้</span>
                      <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Wallet size={20} />
                      </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
                        ฿{Math.abs(totalJobSpendingList).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ค่าใช้จ่ายรวม {(jobDetails?.transactions || []).length} รายการ</p>
                    </div>
                  </div>
                </div>

                {/* Job Transactions Table */}
                <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                      <FileText size={32} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.75rem' }} className="krub-bold">
                        ประวัติธุรกรรมงาน (ID: {jobDetails.id})
                      </h2>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        รายการบันทึกบัญชีแยกประเภทและการสั่งจ่ายเงินสำหรับโครงการนี้
                      </p>
                    </div>
                  </div>

                  {/* Controls Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
                        <select value={jobItemsPerPage} onChange={(e) => { setJobItemsPerPage(Number(e.target.value)); setJobCurrentPage(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                          {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ position: 'relative', width: '300px' }}>
                      <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input type="text" placeholder="ค้นหาเลขที่เอกสาร คำอธิบาย บัญชี หรือผู้บันทึก..." value={jobSearchTerm} onChange={(e) => { setJobSearchTerm(e.target.value); setJobCurrentPage(1); }} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }} />
                    </div>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '1rem 1.5rem', width: '80px' }}>ลำดับ</th>
                          <th onClick={() => handleJobSort('posting_date')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>วันที่ผ่านรายการ {jobSortConfig.key === 'posting_date' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('reference_doc_no')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>เลขที่เอกสาร {jobSortConfig.key === 'reference_doc_no' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('cost_center')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ศูนย์ต้นทุน {jobSortConfig.key === 'cost_center' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('clearing_account')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>บัญชีหักล้าง {jobSortConfig.key === 'clearing_account' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th style={{ padding: '1rem 1.5rem' }}>รายละเอียด</th>
                          <th onClick={() => handleJobSort('username')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ผู้บันทึก {jobSortConfig.key === 'username' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                          <th onClick={() => handleJobSort('value_co_curr')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>จำนวนเงิน {jobSortConfig.key === 'value_co_curr' ? (jobSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentJobItemsList.length === 0 ? (
                          <tr>
                            <td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              ไม่พบข้อมูลธุรกรรมของงานนี้
                            </td>
                          </tr>
                        ) : (
                          currentJobItemsList.map((item, idx) => (
                            <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{((jobCurrentPage - 1) * jobItemsPerPage) + idx + 1}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.posting_date || '-'}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.reference_doc_no || '-'}</td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 500 }}>{item.cost_center}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cost_center_name}</div>
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 500 }}>{item.clearing_account}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.clearing_account_name}</div>
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                                {item.description || '-'}
                              </td>
                              <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.username || '-'}</td>
                              <td style={{
                                padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700,
                                color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)'
                              }}>
                                ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {!loadingJob && totalJobPagesList > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        แสดง {((jobCurrentPage - 1) * jobItemsPerPage) + 1} ถึง {Math.min(jobCurrentPage * jobItemsPerPage, sortedJobTransactionsList.length)} จาก {sortedJobTransactionsList.length} รายการ
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => setJobCurrentPage(p => Math.max(1, p - 1))} disabled={jobCurrentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: jobCurrentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

                        <select
                          value={jobCurrentPage}
                          onChange={(e) => setJobCurrentPage(Number(e.target.value))}
                          className="glass"
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                        >
                          {Array.from({ length: totalJobPagesList }, (_, i) => i + 1).map(p => (
                            <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {totalJobPagesList}</option>
                          ))}
                        </select>

                        <button onClick={() => setJobCurrentPage(p => Math.min(totalJobPagesList, p + 1))} disabled={jobCurrentPage === totalJobPagesList} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: jobCurrentPage === totalJobPagesList ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ) : selectedSiteId ? (
          // VIEW 2: Detail table of specific PEA site
          <motion.div
            key="site_details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => { setSelectedSiteId(null); setSiteJobs([]); }}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง รายการงานทั้งหมด
              </button>
            </div>

            {/* Summary cards for the PEA site */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div className="card glass" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>งานทั้งหมดในสาขา</span>
                  <div style={{ color: 'var(--accent-primary)', background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <ClipboardList size={20} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 700 }}>{siteJobs.length}</span>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>รายการงานที่รับผิดชอบ</p>
                </div>
              </div>

              <div className="card glass" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ธุรกรรมทั้งหมด</span>
                  <div style={{ color: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <FileText size={20} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{siteTransactionsList.length}</span>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>การบันทึกบัญชีและการจ่ายเงิน</p>
                </div>
              </div>

              <div className="card glass" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>งบประมาณที่ใช้ไปรวม</span>
                  <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <Wallet size={20} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
                    ฿{Math.abs(totalSiteSpendingList).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ค่าใช้จ่ายรวมทุกประเภท</p>
                </div>
              </div>
            </div>

            <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                  <Activity size={32} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.75rem' }} className="krub-bold">
                    ธุรกรรมของสาขา {selectedSiteName}
                  </h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    รายการใช้จ่ายและงานที่มอบหมายของสาขาในพื้นที่ {selectedSiteProvince || ''}
                  </p>
                </div>
              </div>

              {/* Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
                    <select value={siteItemsPerPage} onChange={(e) => { setSiteItemsPerPage(Number(e.target.value)); setSiteCurrentPage(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="text" placeholder="ค้นหาชื่องาน เลขที่เอกสาร หรือรายละเอียด..." value={siteSearchTerm} onChange={(e) => { setSiteSearchTerm(e.target.value); setSiteCurrentPage(1); }} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }} />
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th onClick={() => handleSiteSort('job_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ชื่องาน {siteSortConfig.key === 'job_name' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSiteSort('posting_date')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>วันที่ผ่านรายการ {siteSortConfig.key === 'posting_date' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSiteSort('reference_doc_no')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>เลขที่เอกสาร {siteSortConfig.key === 'reference_doc_no' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSiteSort('cost_center')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ศูนย์ต้นทุน {siteSortConfig.key === 'cost_center' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSiteSort('clearing_account')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>บัญชีหักล้าง {siteSortConfig.key === 'clearing_account' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th style={{ padding: '1rem 1.5rem' }}>รายละเอียด</th>
                      <th onClick={() => handleSiteSort('username')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ผู้บันทึก {siteSortConfig.key === 'username' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSiteSort('value_co_curr')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>จำนวนเงิน {siteSortConfig.key === 'value_co_curr' ? (siteSortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSite ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '4rem', textAlign: 'center' }}>
                          <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-warning)' }} />
                          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดธุรกรรม...</p>
                        </td>
                      </tr>
                    ) : currentSiteItemsList.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          ไม่พบข้อมูลธุรกรรมของสาขานี้
                        </td>
                      </tr>
                    ) : (
                      currentSiteItemsList.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{item.job_name}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.posting_date || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.reference_doc_no || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 500 }}>{item.cost_center}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cost_center_name}</div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 500 }}>{item.clearing_account}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.clearing_account_name}</div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                            {item.description || '-'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.username || '-'}</td>
                          <td style={{
                            padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700,
                            color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)'
                          }}>
                            ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loadingSite && totalSitePagesList > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    แสดง {((siteCurrentPage - 1) * siteItemsPerPage) + 1} ถึง {Math.min(siteCurrentPage * siteItemsPerPage, sortedSiteTransactionsList.length)} จาก {sortedSiteTransactionsList.length} รายการ
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => setSiteCurrentPage(p => Math.max(1, p - 1))} disabled={siteCurrentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: siteCurrentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

                    <select
                      value={siteCurrentPage}
                      onChange={(e) => setSiteCurrentPage(Number(e.target.value))}
                      className="glass"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                    >
                      {Array.from({ length: totalSitePagesList }, (_, i) => i + 1).map(p => (
                        <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {totalSitePagesList}</option>
                      ))}
                    </select>

                    <button onClick={() => setSiteCurrentPage(p => Math.min(totalSitePagesList, p + 1))} disabled={siteCurrentPage === totalSitePagesList} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: siteCurrentPage === totalSitePagesList ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // VIEW 1: Main Jobs list
          <motion.div
            key="jobs_list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button 
                onClick={onBack}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับไปยัง Overview
              </button>
            </div>

            <div className="card glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '1rem', color: 'var(--accent-warning)' }}>
                    <ClipboardList size={32} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem' }} className="krub-bold">จัดการงาน (Job Management)</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>รายละเอียดรายการงานและจำนวนธุรกรรมทั้งหมดในระบบ</p>
                  </div>
                </div>

                {canCreate && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="glass font-bold"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.6rem 1.2rem', background: 'var(--accent-primary)',
                      border: 'none', color: '#fff', borderRadius: '0.5rem',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <Plus size={18} /> สร้างงานใหม่
                  </button>
                )}
              </div>

              {/* Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Show:</span>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input type="text" placeholder="ค้นหาชื่องาน รายละเอียด หรือสาขา..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }} />
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th onClick={() => handleSortConfig('id')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '80px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ID {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('job_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ชื่องาน {sortConfig.key === 'job_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('job_description')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>รายละเอียดงาน {sortConfig.key === 'job_description' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('pea_name')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>สาขา PEA {sortConfig.key === 'pea_name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('pea_province')} style={{ padding: '1rem 1.5rem', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>จังหวัด {sortConfig.key === 'pea_province' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('transactions')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', textAlign: 'center', width: '150px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>จำนวนธุรกรรม {sortConfig.key === 'transactions' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                      <th onClick={() => handleSortConfig('createdAt')} style={{ padding: '1rem 1.5rem', cursor: 'pointer', width: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>วันที่สร้าง {sortConfig.key === 'createdAt' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} opacity={0.3} />}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '4rem', textAlign: 'center' }}>
                          <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--accent-warning)' }} />
                          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูลงาน...</p>
                        </td>
                      </tr>
                    ) : currentItemsList.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          ไม่พบข้อมูลงานในระบบ
                        </td>
                      </tr>
                    ) : (
                      currentItemsList.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{item.id}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{item.job_name}</td>
                          <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{item.job_description || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            {item.pea_site?.pea_name ? (
                              <span
                                onClick={() => handleSiteClick(item.pea_site_id, item.pea_site?.pea_name, item.pea_site?.pea_province)}
                                style={{
                                  color: 'var(--accent-warning)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  borderBottom: '1px dashed rgba(245, 158, 11, 0.4)',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => e.target.style.color = '#fff'}
                                onMouseLeave={(e) => e.target.style.color = 'var(--accent-warning)'}
                                title="ดูรายละเอียดธุรกรรมของสาขานี้"
                              >
                                {item.pea_site.pea_name}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>{item.pea_site?.pea_province || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleJobClick(item.id)}
                              className="glass"
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--accent-warning)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="ดูรายละเอียดธุรกรรมของงานเฉพาะรายนี้"
                            >
                              {item.transactions?.length || 0} รายการ
                            </button>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && totalPagesList > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    แสดง {((currentPage - 1) * itemsPerPage) + 1} ถึง {Math.min(currentPage * itemsPerPage, sortedJobsList.length)} จาก {sortedJobsList.length} รายการ
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>

                    <select
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                      className="glass"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                    >
                      {Array.from({ length: totalPagesList }, (_, i) => i + 1).map(p => (
                        <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {totalPagesList}</option>
                      ))}
                    </select>

                    <button onClick={() => setCurrentPage(p => Math.min(totalPagesList, p + 1))} disabled={currentPage === totalPagesList} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: currentPage === totalPagesList ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          MODAL: สร้างงานใหม่ (Create Job Modal)
          ---------------------------------------------------- */}
      <AnimatePresence>
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="card glass" 
              style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowCreateModal(false)} 
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}
              >
                <X size={20} />
              </button>

              <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }} className="krub-bold">สร้างงานใหม่ (Create PEA Job)</h2>
              
              <form onSubmit={handleCreateJobSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>ชื่องาน *</label>
                    <input 
                      type="text" 
                      required 
                      value={newJobName} 
                      onChange={(e) => setNewJobName(e.target.value)} 
                      placeholder="เช่น iCom Hi Tech 2" 
                      style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>สาขา PEA *</label>
                    {loadingSites ? (
                      <div style={{ display: 'flex', alignItems: 'center', height: '38px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Loader2 className="animate-spin" size={16} style={{ marginRight: '0.5rem' }} /> กำลังโหลดสาขา...
                      </div>
                    ) : (
                      <select 
                        required
                        value={selectedSite} 
                        onChange={(e) => setSelectedSite(e.target.value)} 
                        style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="">-- เลือกสาขา PEA --</option>
                        {sites.map(s => (
                          <option key={s.id} value={s.id} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
                            {s.pea_name} {s.province ? `(${s.province})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>รายละเอียดงาน</label>
                  <input 
                    type="text" 
                    value={newJobDesc} 
                    onChange={(e) => setNewJobDesc(e.target.value)} 
                    placeholder="เช่น MA Printer" 
                    style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.5rem', outline: 'none' }}
                  />
                </div>

                {/* SEARCH TRANSACTIONS SECTION */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }} className="krub-semibold">เลือกรายการธุรกรรมงบประมาณ</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>ปีงบประมาณ</label>
                      <input 
                        type="text" 
                        value={txYear} 
                        onChange={(e) => setTxYear(e.target.value)} 
                        placeholder="เช่น 2026"
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>เลขที่เอกสาร</label>
                      <input 
                        type="text" 
                        placeholder="เช่น 2000000522" 
                        value={txReferenceDocNo} 
                        onChange={(e) => setTxReferenceDocNo(e.target.value)} 
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>ผู้บันทึก</label>
                      <input 
                        type="text" 
                        placeholder="เช่น E2DUDSSL02" 
                        value={txUsername} 
                        onChange={(e) => setTxUsername(e.target.value)} 
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>ชื่อศูนย์ต้นทุน</label>
                      <input 
                        type="text" 
                        placeholder="เช่น บำรุง/ค-IT" 
                        value={txCostCenterName} 
                        onChange={(e) => setTxCostCenterName(e.target.value)} 
                        list="modal-tx-cost-center-names"
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                      <datalist id="modal-tx-cost-center-names">
                        {searchSelectors.cost_center_name?.map((n, i) => (
                          <option key={i} value={String(n)}>{n}</option>
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>บัญชีหักล้าง</label>
                      <input 
                        type="text" 
                        placeholder="เช่น 833065" 
                        value={txClearingAccount} 
                        onChange={(e) => setTxClearingAccount(e.target.value)} 
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>ชื่อบัญชีหักล้าง</label>
                      <input 
                        type="text" 
                        placeholder="เช่น เทค" 
                        value={txClearingAccountName} 
                        onChange={(e) => setTxClearingAccountName(e.target.value)} 
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>คำอธิบาย / รายละเอียด</label>
                      <input 
                        type="text" 
                        placeholder="เช่น บำรุงกล้อง..." 
                        value={txDescription} 
                        onChange={(e) => setTxDescription(e.target.value)} 
                        style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: '0.4rem', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleLookupTransactions}
                      disabled={loadingTxSearch}
                      className="glass font-bold"
                      style={{
                        padding: '0.55rem 1.5rem', background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--accent-warning)',
                        borderRadius: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '35px'
                      }}
                    >
                      {loadingTxSearch ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} ค้นหาธุรกรรม
                    </button>
                  </div>

                  {/* Transactions selection box */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                    {searchedTransactions.length === 0 ? (
                      <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
                        ใช้เครื่องมือค้นหาธุรกรรมงบประมาณข้างต้นเพื่อทำการเลือกรายการ
                      </p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '0.5rem 1rem', width: '50px', textAlign: 'center' }}>เลือก</th>
                            <th style={{ padding: '0.5rem 1rem' }}>เลขเอกสารอ้างอิง</th>
                            <th style={{ padding: '0.5rem 1rem' }}>รายละเอียด</th>
                            <th style={{ padding: '0.5rem 1rem' }}>ผู้ใช้</th>
                            <th style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>จำนวนเงิน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchedTransactions.map(t => {
                            const isChecked = selectedTxIds.includes(t.id);
                            return (
                              <tr 
                                key={t.id} 
                                onClick={() => handleToggleTx(t.id)}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: isChecked ? 'rgba(245,158,11,0.05)' : 'none' }}
                                className="table-row-hover"
                              >
                                <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTx(t.id)}
                                    style={{ background: 'none', border: 'none', color: isChecked ? 'var(--accent-warning)' : 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                                  >
                                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                                  </button>
                                </td>
                                <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace' }}>{t.reference_doc_no}</td>
                                <td style={{ padding: '0.5rem 1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description}</td>
                                <td style={{ padding: '0.5rem 1rem' }}>{t.username || '-'}</td>
                                <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: parseFloat(t.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                  ฿{parseFloat(t.value_co_curr || 0).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {selectedTxIds.length > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={16} /> เลือกแล้ว {selectedTxIds.length} รายการธุรกรรมที่จะนำเข้า
                    </div>
                  )}
                </div>

                {/* MODAL ACTIONS */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="glass" 
                    style={{ padding: '0.6rem 1.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '0.5rem', fontWeight: 600 }}
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    disabled={createSubmitting}
                    className="glass font-bold"
                    style={{
                      padding: '0.6rem 1.5rem', background: 'var(--accent-primary)',
                      border: 'none', color: '#fff', borderRadius: '0.5rem',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    {createSubmitting && <Loader2 size={16} className="animate-spin" />}
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default JobManagement;
