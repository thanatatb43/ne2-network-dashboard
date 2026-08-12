import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Search, ChevronLeft, ChevronRight, Boxes, QrCode, X, Download, Plus, Printer, Trash2, AlertTriangle, Repeat, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import BorrowReturnModal from './BorrowReturnModal';
import LoanHistoryModal from './LoanHistoryModal';

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

const getSiteId = (item) => item.pea_site_id ?? item.pea_site?.id ?? null;

const StockManagement = ({ token, user, onBack, onEquipmentClick, onAddStock, onRequireLogin }) => {
  const canEdit = ['super_admin', 'computer_admin', 'network_admin', 'operator'].includes(user?.role);
  const canDelete = ['super_admin', 'computer_admin', 'network_admin'].includes(user?.role);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSiteTab, setActiveSiteTab] = useState(198);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [qrItem, setQrItem] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [borrowItem, setBorrowItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const itemsPerPage = 15;

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success) setEquipment(result.data || []);
    } catch (error) {
      console.error('Error fetching office equipment stock:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Equipment scoped to whichever storage-location tab is active.
  const siteScopedEquipment = React.useMemo(() => {
    return equipment.filter(item => {
      const siteId = getSiteId(item);
      return activeSiteTab === 'other'
        ? !STOCK_SITE_IDS.includes(siteId)
        : siteId === activeSiteTab;
    });
  }, [equipment, activeSiteTab]);

  const siteTabCounts = React.useMemo(() => {
    const counts = { other: 0 };
    STOCK_SITE_IDS.forEach(id => { counts[id] = 0; });
    equipment.forEach(item => {
      const siteId = getSiteId(item);
      if (STOCK_SITE_IDS.includes(siteId)) counts[siteId] += 1;
      else counts.other += 1;
    });
    return counts;
  }, [equipment]);

  const equipmentTypes = React.useMemo(() => {
    const types = new Set();
    siteScopedEquipment.forEach(item => { if (item.equipment_type) types.add(item.equipment_type); });
    return ['All', ...Array.from(types).sort()];
  }, [siteScopedEquipment]);

  const statuses = React.useMemo(() => {
    const s = new Set();
    siteScopedEquipment.forEach(item => { if (item.status) s.add(item.status); });
    return ['All', ...Array.from(s).sort()];
  }, [siteScopedEquipment]);

  const filteredEquipment = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return siteScopedEquipment.filter(item => {
      const matchesSearch = !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.pea_site?.pea_name || '').toLowerCase().includes(q) ||
        (item.ip_address || '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'All' || item.equipment_type === typeFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [siteScopedEquipment, searchTerm, typeFilter, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [activeSiteTab, searchTerm, typeFilter, statusFilter]);

  // A previously selected type/status may not exist in the newly active tab
  // (the dropdown options are scoped per-tab), so reset them on tab switch.
  useEffect(() => {
    setTypeFilter('All');
    setStatusFilter('All');
  }, [activeSiteTab]);

  const totalPages = Math.ceil(filteredEquipment.length / itemsPerPage);
  const currentItems = filteredEquipment.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
        setEquipment(prev => prev.filter(item => item.id !== itemToDelete.id));
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
            onClick={() => setActiveSiteTab(site.id)}
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
              {siteTabCounts[site.id] || 0}
            </span>
          </button>
        ))}
        <button
          onClick={() => setActiveSiteTab('other')}
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
            {siteTabCounts.other || 0}
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.6rem 0.6rem 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {equipmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            แสดง <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentItems.length}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filteredEquipment.length}</span> รายการ
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
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
                  <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังโหลดรายการอุปกรณ์...</p>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Boxes size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p>ไม่พบรายการอุปกรณ์</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onEquipmentClick && onEquipmentClick(item.id)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onEquipmentClick ? 'pointer' : 'default' }}
                    className="table-row-hover"
                    title="คลิกเพื่อดูรายละเอียดอุปกรณ์"
                  >
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

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              หน้า <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage}</span> จาก <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalPages}</span>
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.3 : 1 }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {qrItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
            }}
            onClick={() => setQrItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="card glass"
              style={{ padding: '1.5rem', maxWidth: '340px', width: '100%', borderRadius: '0.75rem', textAlign: 'center' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>QR Code อุปกรณ์</h3>
                <button
                  onClick={() => setQrItem(null)}
                  className="glass"
                  style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              <img
                src={`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${qrItem.id}/qrcode`}
                alt={`QR Code - ${qrItem.name}`}
                style={{ width: '100%', maxWidth: '260px', borderRadius: '0.5rem', background: '#fff', padding: '0.75rem' }}
              />

              <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                {qrItem.name}
              </p>

              <a
                href={`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${qrItem.id}/qrcode`}
                download={`equipment-${qrItem.id}-qrcode.png`}
                className="glass"
                style={{
                  marginTop: '1.25rem', padding: '0.65rem 1.5rem', borderRadius: '0.5rem',
                  background: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600,
                  fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: '0.5rem', textDecoration: 'none'
                }}
              >
                <Download size={16} /> ดาวน์โหลด
              </a>
            </motion.div>
          </motion.div>
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
