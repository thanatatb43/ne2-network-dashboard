import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Search, ChevronLeft, ChevronRight, Boxes, QrCode, X, Plus, Printer, Trash2, AlertTriangle, Repeat, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import BorrowReturnModal from './BorrowReturnModal';
import LoanHistoryModal from './LoanHistoryModal';
import QrCodeModal from './QrCodeModal';

// Fits neatly on one A4 page at a readable size (2 columns x 3 rows).
const QR_PER_PAGE = 6;

const statusColor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

// Fixed storage-location tabs for this page -- the three actual stock rooms,
// plus an "other" bucket for equipment already deployed elsewhere.
const STOCK_SITES = [
  { id: 198, name: 'โรงเก็บของใต้บันได ตึก 2' },
  { id: 199, name: 'โรงเก็บของอาคาร กรย.' },
  { id: 200, name: 'แผนกคอมพิวเตอร์และเครือข่าย' }
];
const STOCK_SITE_IDS = STOCK_SITES.map(s => s.id);
const EXCLUDE_STOCK_SITES_PARAM = STOCK_SITE_IDS.join(',');

// Fixed status list, matching the options office-equipment records are
// created with (see OfficeEquipmentManagement's formFields) -- can't be
// derived from the current page anymore since equipment is server-paginated.
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย'];

// Which storage-location tab/filters were active, kept outside React state so
// they survive StockManagement unmounting -- clicking into an equipment's
// details and back navigates through a different top-level tab in App.jsx,
// which unmounts this component entirely and would otherwise reset the tab
// and every filter back to their defaults on each visit.
const ACTIVE_SITE_TAB_KEY = 'stock_active_site_tab';
const SEARCH_TERM_KEY = 'stock_search_term';
const STATUS_FILTER_KEY = 'stock_status_filter';
const OTHER_SITE_FILTER_KEY = 'stock_other_site_filter';

const readSavedSiteTab = () => {
  const saved = sessionStorage.getItem(ACTIVE_SITE_TAB_KEY);
  if (saved === 'other') return 'other';
  const n = Number(saved);
  return STOCK_SITE_IDS.includes(n) ? n : 198;
};
const readSaved = (key, fallback) => sessionStorage.getItem(key) ?? fallback;

const StockManagement = ({ token, user, onBack, onEquipmentClick, onAddStock, onRequireLogin }) => {
  const canEdit = ['super_admin', 'computer_admin', 'network_admin', 'operator'].includes(user?.role);
  const canDelete = ['super_admin', 'computer_admin', 'network_admin'].includes(user?.role);
  const [equipment, setEquipment] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [activeSiteTab, setActiveSiteTab] = useState(readSavedSiteTab);
  // searchInput is the raw, immediate textbox value; searchTerm is the
  // debounced value actually sent to the API (see the debounce effect below).
  const [searchInput, setSearchInput] = useState(() => readSaved(SEARCH_TERM_KEY, ''));
  const [searchTerm, setSearchTerm] = useState(() => readSaved(SEARCH_TERM_KEY, ''));
  const [statusFilter, setStatusFilter] = useState(() => readSaved(STATUS_FILTER_KEY, 'All'));
  const [otherSiteFilter, setOtherSiteFilter] = useState(() => readSaved(OTHER_SITE_FILTER_KEY, 'all'));
  const [currentPage, setCurrentPage] = useState(1);
  const [peaSites, setPeaSites] = useState([]);
  const [tabCounts, setTabCounts] = useState({ 198: 0, 199: 0, 200: 0, other: 0 });
  const [qrItem, setQrItem] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [borrowItem, setBorrowItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const itemsPerPage = 15;

  // Full PEA site directory -- used only to populate the "other" tab's site
  // filter dropdown, since equipment is server-paginated now and can no
  // longer be scanned locally for the distinct sites it contains.
  const fetchPeaSites = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      const list = result.data || result || [];
      setPeaSites(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites:', error);
    }
  };

  // The "other" tab has no single site id -- it means "not in any of the
  // three storage-location sites" -- so it uses exclude_pea_site_id instead
  // of pea_site_id, unless the user narrowed it down to one specific site.
  const buildEquipmentQuery = (extra = {}) => {
    const params = new URLSearchParams();
    if (activeSiteTab === 'other') {
      if (otherSiteFilter === 'all') {
        params.append('exclude_pea_site_id', EXCLUDE_STOCK_SITES_PARAM);
      } else {
        params.append('pea_site_id', otherSiteFilter);
      }
    } else {
      params.append('pea_site_id', String(activeSiteTab));
    }
    if (statusFilter !== 'All') params.append('status', statusFilter);
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params;
  };

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const params = buildEquipmentQuery({ page: String(currentPage), limit: String(itemsPerPage) });
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) {
        setEquipment(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching office equipment stock:', error);
    } finally {
      setLoading(false);
    }
  };

  // Lightweight limit=1 requests -- only pagination.total is read from each
  // -- used purely to populate the tab badge counts, independent of
  // whichever filters/page are currently active on the visible tab.
  const fetchTabCounts = async () => {
    try {
      const countFor = async (siteParams) => {
        const params = new URLSearchParams({ ...siteParams, limit: '1' });
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/?${params.toString()}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const result = await res.json();
        return result?.pagination?.total ?? 0;
      };
      const [c198, c199, c200, cOther] = await Promise.all([
        countFor({ pea_site_id: '198' }),
        countFor({ pea_site_id: '199' }),
        countFor({ pea_site_id: '200' }),
        countFor({ exclude_pea_site_id: EXCLUDE_STOCK_SITES_PARAM })
      ]);
      setTabCounts({ 198: c198, 199: c199, 200: c200, other: cOther });
    } catch (error) {
      console.error('Error fetching stock tab counts:', error);
    }
  };

  useEffect(() => {
    fetchPeaSites();
    fetchTabCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage, activeSiteTab, otherSiteFilter, statusFilter, searchTerm]);

  // Debounces free-text search into a single request instead of firing one
  // per keystroke; lands together with the page-1 reset so they batch into
  // one re-render instead of racing across two separate effects.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const otherSites = React.useMemo(() => {
    return peaSites
      .filter(s => !STOCK_SITE_IDS.includes(s.id))
      .map(s => ({ id: s.id, name: s.pea_name + (s.pea_province ? ` (${s.pea_province})` : '') }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [peaSites]);

  const handleSiteTabChange = (tab) => {
    setActiveSiteTab(tab);
    setCurrentPage(1);
  };
  const handleOtherSiteFilterChange = (value) => {
    setOtherSiteFilter(value);
    setCurrentPage(1);
  };
  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  useEffect(() => {
    sessionStorage.setItem(ACTIVE_SITE_TAB_KEY, String(activeSiteTab));
  }, [activeSiteTab]);
  useEffect(() => {
    sessionStorage.setItem(SEARCH_TERM_KEY, searchInput);
  }, [searchInput]);
  useEffect(() => {
    sessionStorage.setItem(STATUS_FILTER_KEY, statusFilter);
  }, [statusFilter]);
  useEffect(() => {
    sessionStorage.setItem(OTHER_SITE_FILTER_KEY, otherSiteFilter);
  }, [otherSiteFilter]);

  // Creates N blank equipment records (so each gets a real id), then opens a
  // dedicated print window with their QR codes laid out on A4 pages -- QR
  // stickers get printed and physically attached to devices BEFORE anyone
  // fills in the device's actual details (done later by scanning the code).
  const handleConfirmPrint = async () => {
    const quantity = Math.max(1, Math.min(200, Number(printQuantity) || 0));
    if (quantity < 1) {
      toast.error('กรุณาระบุจำนวนที่ต้องการพิมพ์');
      return;
    }

    setPrinting(true);
    try {
      const defaultSiteId = activeSiteTab !== 'other' ? activeSiteTab : '';
      const createOne = async () => {
        const params = new URLSearchParams();
        params.append('name', 'อุปกรณ์ใหม่ (รอกรอกข้อมูล)');
        params.append('pea_site_id', String(defaultSiteId));
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${token}`
          },
          body: params.toString()
        });
        const result = await response.json();
        return response.ok ? (result.data?.id ?? result.id ?? null) : null;
      };

      const results = await Promise.all(Array.from({ length: quantity }, createOne));
      const createdIds = results.filter(id => id != null);

      if (createdIds.length === 0) {
        toast.error('สร้างรายการอุปกรณ์สำหรับพิมพ์ QR ไม่สำเร็จ');
        return;
      }
      if (createdIds.length < quantity) {
        toast.error(`สร้างได้ ${createdIds.length} จาก ${quantity} รายการ (บางรายการล้มเหลว)`);
      } else {
        toast.success(`สร้างรายการสำหรับพิมพ์ QR สำเร็จ ${createdIds.length} รายการ`);
      }

      openQrPrintWindow(createdIds);
      setShowPrintModal(false);
      setPrintQuantity(1);
      await fetchEquipment();
      fetchTabCounts();
    } catch (error) {
      console.error('Error creating blank equipment for QR printing:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างรายการสำหรับพิมพ์ QR');
    } finally {
      setPrinting(false);
    }
  };

  const openQrPrintWindow = (ids) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    const pages = [];
    for (let i = 0; i < ids.length; i += QR_PER_PAGE) {
      pages.push(ids.slice(i, i + QR_PER_PAGE));
    }

    const pagesHtml = pages.map(pageIds => `
      <div class="page">
        ${pageIds.map(id => `
          <div class="qr-cell">
            <img src="${apiBase}/api/office-equipment/${id}/qrcode" alt="QR ${id}" />
            <div class="caption">ID: ${id}</div>
          </div>
        `).join('')}
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>พิมพ์ QR Code อุปกรณ์</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; }
  .page {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 8mm;
    width: 100%;
    height: 273mm;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .qr-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed #999;
    border-radius: 4mm;
    padding: 6mm;
  }
  .qr-cell img { width: 60mm; height: 60mm; object-fit: contain; }
  .qr-cell .caption { margin-top: 4mm; font-size: 11pt; color: #333; text-align: center; }
</style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleConfirmDelete = async () => {
    if (!canDelete || !itemToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'ลบอุปกรณ์สำเร็จ');
        await fetchEquipment();
        fetchTabCounts();
      } else {
        toast.error(result.message || result.error || 'ลบอุปกรณ์ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error deleting office equipment:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setDeleting(false);
      setItemToDelete(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={onBack}
          className="glass"
          style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowLeft size={16} /> กลับไปยัง Overview
        </button>

        {canEdit && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowPrintModal(true)}
              className="glass"
              style={{
                padding: '0.5rem 1.1rem', borderRadius: '0.5rem',
                border: '1px solid var(--accent-primary)', background: 'var(--bg-accent-subtle)',
                color: 'var(--accent-primary)', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <Printer size={16} /> พิมพ์ QR-Code
            </button>
            <button
              onClick={() => onAddStock && onAddStock(activeSiteTab !== 'other' ? activeSiteTab : null)}
              className="glass"
              style={{
                padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: 'none',
                background: 'var(--accent-primary)', color: '#fff', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <Plus size={16} /> เพิ่ม Stock
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {STOCK_SITES.map(site => (
          <button
            key={site.id}
            onClick={() => handleSiteTabChange(site.id)}
            className="glass"
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '0.6rem',
              border: activeSiteTab === site.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: activeSiteTab === site.id ? 'var(--bg-accent-subtle)' : 'var(--card-bg)',
              color: activeSiteTab === site.id ? 'var(--accent-primary)' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {site.name}
            <span style={{
              fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem',
              background: activeSiteTab === site.id ? 'var(--accent-primary)' : 'var(--glass-bg-subtle)',
              color: activeSiteTab === site.id ? '#fff' : 'var(--text-secondary)'
            }}>
              {tabCounts[site.id] || 0}
            </span>
          </button>
        ))}
        <button
          onClick={() => handleSiteTabChange('other')}
          className="glass"
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '0.6rem',
            border: activeSiteTab === 'other' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            background: activeSiteTab === 'other' ? 'var(--bg-accent-subtle)' : 'var(--card-bg)',
            color: activeSiteTab === 'other' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          อื่นๆ
          <span style={{
            fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem',
            background: activeSiteTab === 'other' ? 'var(--accent-primary)' : 'var(--glass-bg-subtle)',
            color: activeSiteTab === 'other' ? '#fff' : 'var(--text-secondary)'
          }}>
            {tabCounts.other || 0}
          </span>
        </button>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="ค้นหาชื่ออุปกรณ์ / แผนก / สำนักงาน / IP..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.6rem 0.6rem 2.5rem',
                borderRadius: '0.5rem',
                border: searchInput ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                background: searchInput ? 'var(--bg-accent-subtle)' : 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {activeSiteTab === 'other' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem',
              background: otherSiteFilter !== 'all' ? 'var(--bg-accent-subtle)' : 'var(--input-bg)',
              border: otherSiteFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สำนักงาน:</span>
              <select
                value={otherSiteFilter}
                onChange={(e) => handleOtherSiteFilterChange(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="all">ทั้งหมด</option>
                {otherSites.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem',
            background: statusFilter !== 'All' ? 'var(--bg-accent-subtle)' : 'var(--input-bg)',
            border: statusFilter !== 'All' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <option value="All">All</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            แสดง <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{equipment.length}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.total}</span> รายการ
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ID</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่ออุปกรณ์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภท</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>แผนก</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สำนักงาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังโหลดรายการอุปกรณ์...</p>
                  </td>
                </tr>
              ) : equipment.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Boxes size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p>ไม่พบรายการอุปกรณ์</p>
                  </td>
                </tr>
              ) : (
                equipment.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onEquipmentClick && onEquipmentClick(item.id)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onEquipmentClick ? 'pointer' : 'default' }}
                    className="table-row-hover"
                    title="คลิกเพื่อดูรายละเอียดอุปกรณ์"
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{item.id}</td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{item.name || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{item.equipment_type || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>{item.department || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>
                      {item.pea_site ? `${item.pea_site.pea_name}${item.pea_site.pea_province ? ` (${item.pea_site.pea_province})` : ''}` : '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '1rem',
                          fontWeight: 600,
                          color: statusColor(item.status),
                          background: `${statusColor(item.status)}15`
                        }}>
                          {item.status || '-'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQrItem(item); }}
                          title="แสดง QR Code ของอุปกรณ์นี้"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '1.6rem', height: '1.6rem', padding: 0,
                            borderRadius: '0.4rem', border: '1px solid var(--border-subtle)',
                            background: 'var(--glass-bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer'
                          }}
                        >
                          <QrCode size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user) { onRequireLogin && onRequireLogin(); return; }
                            setBorrowItem(item);
                          }}
                          title="ยืม/คืนอุปกรณ์นี้"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '1.6rem', height: '1.6rem', padding: 0,
                            borderRadius: '0.4rem', border: '1px solid rgba(168, 85, 247, 0.3)',
                            background: 'var(--bg-accent-subtle)', color: 'var(--accent-primary)', cursor: 'pointer'
                          }}
                        >
                          <Repeat size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoryItem(item); }}
                          title="ประวัติการยืม-คืน"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '1.6rem', height: '1.6rem', padding: 0,
                            borderRadius: '0.4rem', border: '1px solid var(--border-subtle)',
                            background: 'var(--glass-bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer'
                          }}
                        >
                          <History size={13} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                            title="ลบอุปกรณ์นี้"
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '1.6rem', height: '1.6rem', padding: 0,
                              borderRadius: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              หน้า <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.totalPages}</span>
            </span>
            <button
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === pagination.totalPages ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {qrItem && (
          <QrCodeModal
            equipmentId={qrItem.id}
            equipmentName={qrItem.name}
            updatedAt={qrItem.updatedAt}
            onClose={() => setQrItem(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
            }}
            onClick={() => !printing && setShowPrintModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '1.5rem', maxWidth: '360px', width: '100%', borderRadius: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>พิมพ์ QR-Code</h3>
                <button
                  onClick={() => !printing && setShowPrintModal(false)}
                  className="glass"
                  style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: printing ? 'not-allowed' : 'pointer', display: 'flex' }}
                  disabled={printing}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                ระบบจะสร้างรายการอุปกรณ์เปล่าจำนวนเท่ากับที่ระบุ (รอกรอกข้อมูลภายหลัง) แล้วเปิดหน้าต่างพิมพ์ QR Code ให้อัตโนมัติ -- จัดหน้ากระดาษ A4 สูงสุด {QR_PER_PAGE} QR ต่อแผ่น
              </p>

              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>จำนวนที่ต้องการพิมพ์</label>
              <input
                type="number"
                min="1"
                max="200"
                value={printQuantity}
                onChange={(e) => setPrintQuantity(e.target.value)}
                disabled={printing}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                  color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1.25rem'
                }}
              />

              <button
                onClick={handleConfirmPrint}
                disabled={printing}
                className="glass"
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                  background: 'var(--accent-primary)', color: '#fff', border: 'none',
                  fontWeight: 700, fontSize: '0.95rem',
                  cursor: printing ? 'not-allowed' : 'pointer', opacity: printing ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                {printing ? 'กำลังสร้างรายการ...' : 'สร้างและพิมพ์'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
            }}
            onClick={() => !deleting && setItemToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '1.5rem', maxWidth: '340px', width: '100%', borderRadius: '0.75rem', textAlign: 'center' }}
            >
              <AlertTriangle size={36} color="var(--accent-danger)" style={{ margin: '0 auto 1rem' }} />
              <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                ต้องการลบอุปกรณ์ <strong style={{ color: 'var(--text-primary)' }}>{itemToDelete.name || 'นี้'}</strong> ใช่หรือไม่?<br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setItemToDelete(null)}
                  disabled={deleting}
                  className="glass"
                  style={{
                    flex: 1, padding: '0.65rem', borderRadius: '0.5rem',
                    border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
                    cursor: deleting ? 'not-allowed' : 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="glass"
                  style={{
                    flex: 1, padding: '0.65rem', borderRadius: '0.5rem', border: 'none',
                    background: 'var(--accent-danger)', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  ลบอุปกรณ์
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {borrowItem && (
          <BorrowReturnModal
            equipmentId={borrowItem.id}
            equipmentName={borrowItem.name}
            token={token}
            onClose={() => setBorrowItem(null)}
            onChanged={() => { setBorrowItem(null); fetchEquipment(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyItem && (
          <LoanHistoryModal
            equipmentId={historyItem.id}
            equipmentName={historyItem.name}
            onClose={() => setHistoryItem(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StockManagement;
