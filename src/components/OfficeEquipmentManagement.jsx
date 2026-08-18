import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ArrowLeft, Loader2, Search, Building2, ChevronRight, ChevronLeft, Monitor as MonitorIcon, Plus, Edit2, Trash2, Save, AlertTriangle, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, X, QrCode, UserCog, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QrCodeModal from './QrCodeModal';
import OwnerHistoryModal from './OwnerHistoryModal';

const statusColor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  return 'var(--text-secondary)';
};

// IP allocation plan by device/department group, used to suggest a last-octet
// range while filling in the IP Address field. Ranges differ by which subnet
// the site actually uses (primary /24, a 172.x subnet, or a 10.x subnet).
const IP_RANGE_GROUPS = [
  { group: 'Wireless LAN (AP)', primary: '1-10', sub172: '1-20', sub10: '1-20', usableIPs: 50 },
  { group: 'Voice Gateway', primary: '11-20', sub172: '21-30', sub10: '21-30', usableIPs: 30 },
  { group: 'UC', primary: null, sub172: '31-50', sub10: '31-50', usableIPs: 40 },
  { group: 'VDO Conference', primary: null, sub172: null, sub10: '81-90', usableIPs: 10 },
  { group: 'CCTV', primary: null, sub172: null, sub10: '91-120', usableIPs: 30 },
  { group: 'DHCP', primary: '100-200', sub172: null, sub10: null, usableIPs: 100 },
  { group: 'ระบบ Queue', primary: '221', sub172: '221', sub10: null, usableIPs: 2 },
  { group: 'อื่นๆ', primary: '222-240', sub172: null, sub10: '151-200', usableIPs: 50 },
  { group: 'Network', primary: null, sub172: null, sub10: '201-254', usableIPs: 54 },
  { group: 'Gateway (/24)', primary: '241', sub172: '241', sub10: '241', usableIPs: 3 },
  { group: 'ผสน', primary: null, sub172: '100-120', sub10: null, usableIPs: 20 },
  { group: 'ผบร', primary: null, sub172: '121-140', sub10: null, usableIPs: 20 },
  { group: 'ผบส', primary: null, sub172: '141-160', sub10: null, usableIPs: 20 },
  { group: 'ผปบ', primary: null, sub172: '161-180', sub10: null, usableIPs: 20 },
  { group: 'ผกส', primary: null, sub172: '181-200', sub10: null, usableIPs: 20 },
  { group: 'ผมต', primary: null, sub172: '201-220', sub10: null, usableIPs: 20 },
  { group: 'ผคพ (แยกจากวงสำนักงาน)', primary: null, sub172: null, sub10: null, usableIPs: null },
  { group: 'printer', primary: '20-50', sub172: null, sub10: '121-150', usableIPs: 50 },
  { group: 'ผู้บริหาร + บุคลากรอื่นๆ', primary: '51-80', sub172: '51-80', sub10: null, usableIPs: 60 },
  { group: 'กฟส (ผปร)', primary: null, sub172: '81-110', sub10: null, usableIPs: 30 },
  { group: 'กฟส (ผบค)', primary: null, sub172: '111-140', sub10: null, usableIPs: 30 },
  { group: 'กฟส (ผบง)', primary: null, sub172: '141-170', sub10: null, usableIPs: 30 }
];

// Loosely matches the current department/equipment_type text against a group
// name (either direction, case-insensitive) so a suggestion can show up while typing.
const findMatchingIpGroups = (department, equipmentType) => {
  const dept = (department || '').trim().toLowerCase();
  const type = (equipmentType || '').trim().toLowerCase();
  if (!dept && !type) return [];
  return IP_RANGE_GROUPS.filter(g => {
    const name = g.group.toLowerCase();
    return (dept && (name.includes(dept) || dept.includes(name))) ||
      (type && (name.includes(type) || type.includes(name)));
  });
};

// Combines a site's real subnet base (e.g. "172.21.149.241") with a relative
// last-octet range (e.g. "1-20") into a concrete, copyable IP range.
// Falls back to the relative-only form (".1-20") when the site's base IP isn't known yet.
const buildIpRangeDisplay = (baseIp, range) => {
  if (!range) return null;
  // Backend sends "-" when a site has no subnet of that kind (e.g. no secondary_172).
  const validBase = baseIp && baseIp !== '-' ? baseIp : null;
  const prefix = validBase ? `${validBase.split('.').slice(0, 3).join('.')}.` : '.';
  if (range.includes('-')) {
    const [start, end] = range.split('-');
    return `${prefix}${start} - ${prefix}${end}`;
  }
  return `${prefix}${range}`;
};

const formFields = [
  { name: 'name', label: 'ชื่ออุปกรณ์', type: 'text', required: true },
  {
    name: 'equipment_type', label: 'ประเภทอุปกรณ์', type: 'combo', options: [
      'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
      'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
    ]
  },
  {
    name: 'department', label: 'แผนก', type: 'combo', options: [
      'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
      'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
    ]
  },
  { name: 'ip_address', label: 'IP Address', type: 'text' },
  { name: 'mac_address', label: 'MAC Address', type: 'text' },
  { name: 'status', label: 'สถานะ', type: 'select', options: ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย'] },
  { name: 'vendor', label: 'ผู้ขาย (Vendor)', type: 'text' },
  { name: 'contract_no', label: 'เลขที่สัญญา', type: 'text' },
  { name: 'contract_start_date', label: 'วันเริ่มสัญญา', type: 'date' },
  { name: 'contract_expiry_date', label: 'วันหมดอายุสัญญา', type: 'date' },
  { name: 'serial_number', label: 'Serial Number', type: 'text' },
  { name: 'asset_number', label: 'รหัสทรัพย์สิน', type: 'text' },
  { name: 'asset_owner', label: 'ผู้ถือครอง', type: 'text' },
  { name: 'asset_owner_emp_id', label: 'รหัสพนักงานผู้ถือครอง', type: 'text' },
  { name: 'storage_location', label: 'สถานที่ติดตั้งหรือจัดเก็บ', type: 'text' },
  { name: 'notes', label: 'หมายเหตุ', type: 'text', placeholder: 'รายละเอียด ที่ตั้ง หรือข้อมูลอื่นๆ' }
];

const isValidIpAddress = (ip) => {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  return ip.split('.').every(part => Number(part) <= 255);
};
const isValidMacAddress = (mac) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);

// Same fixed pea_site_id StockManagement.jsx pins as the department's own
// storage/equipment location -- shown as its own tab instead of buried in
// the alphabetical list of every PEA branch office.
const DEPT_SITE_ID = 200;

const OfficeEquipmentManagement = ({ token, onBack, user, selectedSiteId = null, onSelectSite }) => {
  // Which top-level tab is active. Defaults to the department tab, unless we
  // land here already deep-linked to a specific other site (e.g. browser
  // back/forward), in which case the "other" tab should show as active.
  const [activeMainTab, setActiveMainTab] = useState(() =>
    selectedSiteId && String(selectedSiteId) !== String(DEPT_SITE_ID) ? 'other' : 'main'
  );
  // The department tab always shows DEPT_SITE_ID's equipment regardless of
  // the URL-controlled selectedSiteId; the "other" tab defers to it as before.
  const effectiveSiteId = activeMainTab === 'main' ? DEPT_SITE_ID : selectedSiteId;
  const view = (activeMainTab === 'main' || selectedSiteId) ? 'detail' : 'sites';
  const [loadingSites, setLoadingSites] = useState(true);
  const [peaSites, setPeaSites] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [siteSearch, setSiteSearch] = useState('');

  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [siteNetworkIp, setSiteNetworkIp] = useState(null); // { main, secondary_172, secondary_10 } for the selected site
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [editingItem, setEditingItem] = useState(null); // null | { isNew: true } | equipment object
  const [formData, setFormData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);
  const [showOwnerHistory, setShowOwnerHistory] = useState(false);
  const [responseModal, setResponseModal] = useState(null); // { type: 'success' | 'error', message: string }
  const [showIpReference, setShowIpReference] = useState(false);

  const canEdit = ['super_admin', 'computer_admin', 'network_admin', 'operator'].includes(user?.role);
  const canDelete = user?.role === 'super_admin';

  const suggestedIpGroups = React.useMemo(
    () => findMatchingIpGroups(formData.department, formData.equipment_type),
    [formData.department, formData.equipment_type]
  );

  // Full list of PEA sites (includes sites with zero equipment, unlike deriving from equipment data)
  const fetchPeaSites = async () => {
    setLoadingSites(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      const list = result.data || result || [];
      setPeaSites(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites:', error);
      toast.error('ไม่สามารถโหลดรายชื่อสำนักงานการไฟฟ้าได้');
    } finally {
      setLoadingSites(false);
    }
  };

  // Equipment across all sites, used only to compute the per-site count badge
  const fetchAllEquipment = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAllEquipment(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching office equipment counts:', error);
    }
  };

  useEffect(() => {
    fetchPeaSites();
    fetchAllEquipment();
  }, []);

  // Combine the full PEA site list with equipment counts (sites with no equipment still show up)
  const sites = React.useMemo(() => {
    const countMap = new Map();
    allEquipment.forEach(item => {
      const siteId = item.pea_site_id ?? item.pea_site?.id;
      if (siteId == null) return;
      countMap.set(siteId, (countMap.get(siteId) || 0) + 1);
    });
    return peaSites
      .map(s => ({ id: s.id, pea_name: s.pea_name, pea_province: s.pea_province, count: countMap.get(s.id) || 0 }));
  }, [peaSites, allEquipment]);

  // The department itself gets its own tab, so it's excluded from the
  // "other sites" list to avoid showing it twice.
  const filteredSites = React.useMemo(() => {
    const base = sites.filter(s => s.id !== DEPT_SITE_ID);
    if (!siteSearch) return base;
    const q = siteSearch.toLowerCase();
    return base.filter(s =>
      (s.pea_name && s.pea_name.toLowerCase().includes(q)) ||
      (s.pea_province && s.pea_province.toLowerCase().includes(q))
    );
  }, [sites, siteSearch]);

  // Resolved once the site list has loaded; may briefly be null right after a
  // deep-link / back-navigation lands on a site's URL before sites finish fetching.
  const selectedSite = React.useMemo(
    () => sites.find(s => String(s.id) === String(effectiveSiteId)) || null,
    [sites, effectiveSiteId]
  );

  // Equipment counts for the two tab badges.
  const deptEquipmentCount = React.useMemo(
    () => allEquipment.filter(item => (item.pea_site_id ?? item.pea_site?.id) === DEPT_SITE_ID).length,
    [allEquipment]
  );
  const otherEquipmentCount = allEquipment.length - deptEquipmentCount;

  const fetchSiteEquipment = async (siteId) => {
    setLoadingEquipment(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/site/${siteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setEquipment(result.data || []);
        setSiteNetworkIp(result.network_ip || null);
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ของสำนักงานนี้ได้');
      }
    } catch (error) {
      console.error('Error fetching site equipment:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setLoadingEquipment(false);
    }
  };

  // Fetches automatically whenever the effective site changes -- by tab
  // switch, by site click, or by the browser back/forward buttons restoring
  // a previously visited site.
  useEffect(() => {
    setEquipmentSearch('');
    setSelectedType('All');
    setCurrentPage(1);
    setEditingItem(null);
    if (effectiveSiteId) {
      fetchSiteEquipment(effectiveSiteId);
    } else {
      setEquipment([]);
      setSiteNetworkIp(null);
    }
  }, [effectiveSiteId]);

  const handleSiteClick = (site) => {
    onSelectSite && onSelectSite(site.id);
  };

  const handleBackToSites = () => {
    onSelectSite && onSelectSite(null);
  };

  const handleTabClick = (tab) => {
    setActiveMainTab(tab);
    if (selectedSiteId) onSelectSite && onSelectSite(null);
  };

  const equipmentTypes = React.useMemo(() => {
    const types = new Set(equipment.map(item => item.equipment_type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [equipment]);

  const filteredEquipment = React.useMemo(() => {
    return equipment.filter(item => {
      const matchesType = selectedType === 'All' || item.equipment_type === selectedType;
      if (!matchesType) return false;
      if (!equipmentSearch) return true;
      const q = equipmentSearch.toLowerCase();
      return (
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.ip_address && item.ip_address.toLowerCase().includes(q)) ||
        (item.mac_address && item.mac_address.toLowerCase().includes(q)) ||
        (item.department && item.department.toLowerCase().includes(q)) ||
        (item.equipment_type && item.equipment_type.toLowerCase().includes(q)) ||
        (item.vendor && item.vendor.toLowerCase().includes(q))
      );
    });
  }, [equipment, equipmentSearch, selectedType]);

  const totalPages = Math.ceil(filteredEquipment.length / itemsPerPage);
  const paginatedEquipment = filteredEquipment.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Exports always cover every device on this site -- not just whatever the
  // on-screen search/type filter or current page happens to show -- so they
  // build from the full `equipment` list rather than filteredEquipment/paginatedEquipment.
  const buildExportRows = () => equipment.map(item => ({
    'ชื่ออุปกรณ์': item.name || '-',
    'ประเภท': item.equipment_type || '-',
    'แผนก': item.department || '-',
    'IP Address': item.ip_address || '-',
    'MAC Address': item.mac_address || '-',
    'สถานะ': item.status || '-',
    'ผู้ขาย': item.vendor || '-',
    'เลขที่สัญญา': item.contract_no || '-',
    'วันเริ่มสัญญา': item.contract_start_date || '-',
    'วันหมดอายุสัญญา': item.contract_expiry_date || '-',
    'Serial Number': item.serial_number || '-',
    'รหัสทรัพย์สิน': item.asset_number || '-',
    'ผู้ถือครอง': item.asset_owner || '-',
    'รหัสพนักงานผู้ถือครอง': item.asset_owner_emp_id || '-',
    'สถานที่ติดตั้งหรือจัดเก็บ': item.storage_location || '-',
    'หมายเหตุ': item.notes || '-'
  }));

  const exportFileBaseName = () => {
    const rawName = activeMainTab === 'main' ? 'แผนกคอมพิวเตอร์และเครือข่าย' : (selectedSite?.pea_name || 'site');
    const siteName = rawName.replace(/[\\/:*?"<>|]/g, '_');
    return `Computer_Management_${siteName}_${new Date().toISOString().split('T')[0]}`;
  };

  const exportToExcel = () => {
    if (equipment.length === 0) {
      toast.error('ไม่มีข้อมูลอุปกรณ์สำหรับส่งออก');
      return;
    }
    const rows = buildExportRows();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'อุปกรณ์');
    XLSX.writeFile(workbook, `${exportFileBaseName()}.xlsx`);
    toast.success(`ส่งออก Excel สำเร็จ (${rows.length} รายการ)`);
  };

  const handleAddClick = () => {
    if (!canEdit) return;
    setEditingItem({ isNew: true });
    setFormData({
      name: '', equipment_type: '', department: '', ip_address: '', mac_address: '',
      status: 'ใช้งาน', vendor: '', contract_no: '', contract_start_date: '', contract_expiry_date: '', notes: ''
    });
  };

  const handleEditClick = (item) => {
    if (!canEdit) return;
    setEditingItem(item);
    setFormData(item);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const refreshAfterMutation = async () => {
    await fetchSiteEquipment(effectiveSiteId);
    fetchAllEquipment();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit || !effectiveSiteId) return;

    const ipValue = (formData.ip_address || '').trim();
    if (ipValue && !isValidIpAddress(ipValue)) {
      toast.error('IP Address ไม่ถูกต้อง กรุณากรอกรูปแบบ เช่น 172.21.5.10');
      return;
    }
    const macValue = (formData.mac_address || '').trim();
    if (macValue && !isValidMacAddress(macValue)) {
      toast.error('MAC Address ไม่ถูกต้อง ต้องเป็นรูปแบบ AA:BB:CC:DD:EE:FF (ตัวพิมพ์ใหญ่) เท่านั้น');
      return;
    }

    setActionLoading(true);
    const isNew = editingItem.isNew;
    const url = isNew
      ? `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment`
      : `${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${editingItem.id}`;

    try {
      const params = new URLSearchParams();
      const payload = { ...formData, pea_site_id: String(effectiveSiteId) };
      formFields.forEach(field => {
        params.append(field.name, payload[field.name] || '');
      });
      params.append('pea_site_id', payload.pea_site_id);

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
        handleCancelEdit();
        await refreshAfterMutation();
      } else {
        setResponseModal({
          type: 'error',
          message: result.message || result.error || 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง'
        });
      }
    } catch (err) {
      console.error('Error saving office equipment:', err);
      setResponseModal({ type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!canDelete || !itemToDelete) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (response.ok) {
        setResponseModal({ type: 'success', message: result.message || 'ลบอุปกรณ์สำเร็จ' });
        await refreshAfterMutation();
      } else {
        setResponseModal({ type: 'error', message: result.message || result.error || 'ลบอุปกรณ์ไม่สำเร็จ' });
      }
    } catch (err) {
      console.error('Error deleting office equipment:', err);
      setResponseModal({ type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' });
    } finally {
      setActionLoading(false);
      setItemToDelete(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          onClick={() => handleTabClick('main')}
          className="glass"
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '0.6rem',
            border: activeMainTab === 'main' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            background: activeMainTab === 'main' ? 'var(--bg-accent-subtle)' : 'var(--card-bg)',
            color: activeMainTab === 'main' ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          แผนกคอมพิวเตอร์และเครือข่าย
          <span style={{
            fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '1rem',
            background: activeMainTab === 'main' ? 'var(--accent-primary)' : 'var(--glass-bg-subtle)',
            color: activeMainTab === 'main' ? '#fff' : 'var(--text-secondary)'
          }}>
            {deptEquipmentCount}
          </span>
        </button>
        <button
          onClick={() => handleTabClick('other')}
          className="glass"
          style={{
            padding: '0.6rem 1.1rem',
            borderRadius: '0.6rem',
            border: activeMainTab === 'other' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            background: activeMainTab === 'other' ? 'var(--bg-accent-subtle)' : 'var(--card-bg)',
            color: activeMainTab === 'other' ? 'var(--accent-primary)' : 'var(--text-primary)',
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
            background: activeMainTab === 'other' ? 'var(--accent-primary)' : 'var(--glass-bg-subtle)',
            color: activeMainTab === 'other' ? '#fff' : 'var(--text-secondary)'
          }}>
            {otherEquipmentCount}
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'sites' ? (
          <motion.div key="sites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                onClick={onBack}
                className="glass"
                style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} /> กลับ
              </button>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาสำนักงาน/จังหวัด..."
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem 0.5rem 2.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--input-border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '240px'
                  }}
                />
              </div>
            </div>

            <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สำนักงานการไฟฟ้า</th>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>จังหวัด</th>
                      <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>จำนวนอุปกรณ์</th>
                      <th style={{ padding: '1rem 1.5rem', width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSites ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                          <p style={{ marginTop: '1rem' }}>กำลังโหลดข้อมูลสำนักงาน...</p>
                        </td>
                      </tr>
                    ) : filteredSites.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          ไม่พบข้อมูลสำนักงานการไฟฟ้า
                        </td>
                      </tr>
                    ) : (
                      filteredSites.map(site => (
                        <tr
                          key={site.id}
                          onClick={() => handleSiteClick(site)}
                          style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '0.75rem', color: '#3b82f6', display: 'flex' }}>
                                <Building2 size={18} />
                              </div>
                              {site.pea_name}
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{site.pea_province || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#3b82f6', fontWeight: 600 }}>
                              <MonitorIcon size={14} /> {site.count}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                            <ChevronRight size={18} color="var(--text-secondary)" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={editingItem ? handleCancelEdit : (activeMainTab === 'main' ? onBack : handleBackToSites)}
                  className="glass"
                  style={{ padding: '0.5rem 1rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <ArrowLeft size={16} /> {activeMainTab === 'main' && !editingItem ? 'กลับไปยัง Overview' : 'กลับ'}
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
                    {activeMainTab === 'main' ? 'แผนกคอมพิวเตอร์และเครือข่าย' : selectedSite?.pea_name}
                  </h2>
                  <p style={{ margin: '0.15rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {activeMainTab === 'main' ? 'อุปกรณ์ของแผนก' : selectedSite?.pea_province}
                  </p>
                </div>
              </div>

              {!editingItem && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
                    <select
                      value={selectedType}
                      onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {equipmentTypes.map(t => <option key={t} value={t} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{t}</option>)}
                    </select>
                  </div>
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {[10, 25, 50, 100].map(v => <option key={v} value={v} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="ค้นหาอุปกรณ์..."
                      value={equipmentSearch}
                      onChange={(e) => { setEquipmentSearch(e.target.value); setCurrentPage(1); }}
                      style={{
                        padding: '0.5rem 1rem 0.5rem 2.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--input-border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '220px'
                      }}
                    />
                  </div>
                  <button
                    onClick={exportToExcel}
                    className="glass"
                    style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'var(--accent-success)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    <FileSpreadsheet size={16} /> Export Excel
                  </button>
                  {canEdit && (
                    <button
                      onClick={handleAddClick}
                      className="glass"
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                    >
                      <Plus size={16} /> เพิ่มอุปกรณ์
                    </button>
                  )}
                </div>
              )}
            </div>

            {editingItem ? (
              <div className="card glass" style={{ padding: '2rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  {editingItem.isNew ? 'เพิ่มอุปกรณ์สำนักงาน' : 'แก้ไขอุปกรณ์สำนักงาน'}
                </h2>

                {siteNetworkIp && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                      { label: 'วงหลัก', ip: siteNetworkIp.main },
                      { label: '172.x (สำรอง)', ip: siteNetworkIp.secondary_172 },
                      { label: '10.221.x', ip: siteNetworkIp.secondary_10 },
                      // Sites without a 172.x secondary subnet send a DHCP range instead.
                      { label: 'DHCP Range', ip: siteNetworkIp.dhcp_range }
                    ].filter(item => item.ip && item.ip !== '-').map(item => (
                      <div
                        key={item.label}
                        className="glass"
                        style={{ padding: '0.5rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>{item.label}:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)' }}>{item.ip}</span>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  {formFields.map(field => (
                    <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {field.label}{field.required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleInputChange}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--input-border)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {field.allowBlank && (
                            <option value="" style={{ background: '#ffffff', color: '#0f172a' }}>-- ไม่ระบุ --</option>
                          )}
                          {field.options.map(opt => (
                            <option key={opt} value={opt} style={{ background: '#ffffff', color: '#0f172a' }}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'combo' ? (
                        <>
                          <input
                            type="text"
                            list={`${field.name}-options`}
                            name={field.name}
                            value={formData[field.name] || ''}
                            onChange={handleInputChange}
                            placeholder="เลือกจากรายการ หรือพิมพ์เอง..."
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--input-border)',
                              background: 'var(--input-bg)',
                              color: 'var(--text-primary)'
                            }}
                          />
                          <datalist id={`${field.name}-options`}>
                            {field.options.map(opt => <option key={opt} value={opt} />)}
                          </datalist>
                        </>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={handleInputChange}
                          placeholder={field.placeholder}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--input-border)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)'
                          }}
                          required={field.required}
                        />
                      )}
                      {field.name === 'ip_address' && suggestedIpGroups.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {suggestedIpGroups.map(g => (
                            <div key={g.group} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                              <Info size={13} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                              <span>
                                ช่วง IP แนะนำสำหรับ "{g.group}":{' '}
                                {[
                                  g.primary && `วงหลัก ${buildIpRangeDisplay(siteNetworkIp?.main, g.primary)}`,
                                  g.sub172 && `172.x (สำรอง) ${buildIpRangeDisplay(siteNetworkIp?.secondary_172, g.sub172)}`,
                                  g.sub10 && `10.221.x ${buildIpRangeDisplay(siteNetworkIp?.secondary_10, g.sub10)}`
                                ].filter(Boolean).join(' / ') || 'ไม่มีข้อมูลช่วง IP'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {field.name === 'ip_address' && (
                        <button
                          type="button"
                          onClick={() => setShowIpReference(prev => !prev)}
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}
                        >
                          {showIpReference ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          ดูตารางช่วง IP ทั้งหมด
                        </button>
                      )}
                    </div>
                  ))}

                  {showIpReference && (
                    <div style={{ gridColumn: '1 / -1', overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '0.75rem' }}>
                      <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                            <th style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)' }}>กลุ่ม</th>
                            <th style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)' }}>วงหลัก</th>
                            <th style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)' }}>172.x (สำรอง)</th>
                            <th style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)' }}>10.221.x</th>
                            <th style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>ใช้งานได้</th>
                          </tr>
                        </thead>
                        <tbody>
                          {IP_RANGE_GROUPS.map(g => (
                            <tr key={g.group} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.5rem 1rem', fontWeight: 600 }}>{g.group}</td>
                              <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace' }}>{g.primary || '-'}</td>
                              <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace' }}>{g.sub172 || '-'}</td>
                              <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace' }}>{g.sub10 || '-'}</td>
                              <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{g.usableIPs ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="glass"
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-danger)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                      disabled={actionLoading}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      บันทึก
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่ออุปกรณ์</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภท</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>แผนก</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IP Address</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>MAC Address</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สถานะ</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผู้ขาย / สัญญา</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>หมายเหตุ</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingEquipment ? (
                        <tr>
                          <td colSpan="9" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                            <p style={{ marginTop: '1rem' }}>กำลังโหลดข้อมูลอุปกรณ์...</p>
                          </td>
                        </tr>
                      ) : paginatedEquipment.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            ไม่มีอุปกรณ์ในสำนักงานนี้
                          </td>
                        </tr>
                      ) : (
                        paginatedEquipment.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => setViewingItem(item)}
                            style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                            className="table-row-hover"
                            title="คลิกเพื่อดูรายละเอียดอุปกรณ์"
                          >
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{item.name || '-'}</td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.equipment_type || '-'}</td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.department || '-'}</td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.ip_address || '-'}</td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.mac_address || '-'}</td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '1rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: statusColor(item.status),
                                background: `${statusColor(item.status)}15`
                              }}>
                                {item.status || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <div>{item.vendor || '-'}</div>
                              {item.contract_no && <div style={{ fontSize: '0.75rem' }}>เลขที่: {item.contract_no}</div>}
                              {item.contract_expiry_date && <div style={{ fontSize: '0.75rem' }}>หมดอายุ: {item.contract_expiry_date}</div>}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                              {item.notes || '-'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                  className="glass"
                                  style={{ padding: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', borderRadius: '0.25rem', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}
                                  disabled={!canEdit}
                                  title={canEdit ? 'แก้ไขอุปกรณ์' : 'ไม่มีสิทธิ์แก้ไข'}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                                  className="glass"
                                  style={{ padding: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '0.25rem', cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.5 }}
                                  disabled={!canDelete}
                                  title={canDelete ? 'ลบอุปกรณ์' : 'ไม่มีสิทธิ์ลบ'}
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

                {!loadingEquipment && filteredEquipment.length > itemsPerPage && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--glass-bg-subtle)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, filteredEquipment.length)} จาก {filteredEquipment.length} รายการ
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, color: '#0f172a' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, color: '#0f172a' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Equipment Detail Modal */}
      <AnimatePresence>
        {viewingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, padding: '1rem'
            }}
            onClick={() => setViewingItem(null)}
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
                  onClick={() => setViewingItem(null)}
                  className="glass"
                  style={{ padding: '0.4rem', borderRadius: '0.5rem', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{viewingItem.name || '-'}</h2>
                  <span style={{
                    display: 'inline-block', marginTop: '0.5rem', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: statusColor(viewingItem.status),
                    background: `${statusColor(viewingItem.status)}15`
                  }}>
                    {viewingItem.status || '-'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setQrItem(viewingItem)}
                    className="glass"
                    style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--input-border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <QrCode size={16} /> QR Code
                  </button>
                  <button
                    onClick={() => setShowOwnerHistory(true)}
                    className="glass"
                    style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--input-border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <UserCog size={16} /> ประวัติผู้ถือครอง
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>ประเภท:</span> {viewingItem.equipment_type || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>แผนก:</span> {viewingItem.department || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>IP Address:</span> <span style={{ fontFamily: 'monospace' }}>{viewingItem.ip_address || '-'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>MAC Address:</span> <span style={{ fontFamily: 'monospace' }}>{viewingItem.mac_address || '-'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>ผู้ขาย:</span> {viewingItem.vendor || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>เลขที่สัญญา:</span> {viewingItem.contract_no || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>วันเริ่มสัญญา:</span> {viewingItem.contract_start_date || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>วันหมดอายุสัญญา:</span> {viewingItem.contract_expiry_date || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>Serial Number:</span> <span style={{ fontFamily: 'monospace' }}>{viewingItem.serial_number || '-'}</span></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>รหัสทรัพย์สิน:</span> {viewingItem.asset_number || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>ผู้ถือครอง:</span> {viewingItem.asset_owner || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>รหัสพนักงานผู้ถือครอง:</span> {viewingItem.asset_owner_emp_id || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>สถานที่ติดตั้งหรือจัดเก็บ:</span> {viewingItem.storage_location || '-'}</div>
                </div>

                {viewingItem.notes && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>หมายเหตุ:</span> {viewingItem.notes}
                  </div>
                )}

                {viewingItem.created_by && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    บันทึกโดย {viewingItem.created_by.first_name} {viewingItem.created_by.last_name} (@{viewingItem.created_by.username})
                    {viewingItem.updatedAt && ` · แก้ไขล่าสุด ${new Date(viewingItem.updatedAt).toLocaleString('th-TH')}`}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {qrItem && (
          <QrCodeModal
            equipmentId={qrItem.id}
            equipmentName={qrItem.name}
            updatedAt={qrItem.updatedAt}
            onClose={() => setQrItem(null)}
          />
        )}
        {showOwnerHistory && viewingItem && (
          <OwnerHistoryModal
            equipmentId={viewingItem.id}
            equipmentName={viewingItem.name}
            token={token}
            onClose={() => setShowOwnerHistory(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
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
            onClick={() => !actionLoading && setItemToDelete(null)}
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
                คุณแน่ใจหรือไม่ว่าต้องการลบอุปกรณ์ <strong style={{ color: 'var(--text-primary)' }}>{itemToDelete.name || 'นี้'}</strong>?<br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setItemToDelete(null)}
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
                width: '64px', height: '64px', borderRadius: '50%',
                background: responseModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: responseModal.type === 'success' ? '#10b981' : '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                {responseModal.type === 'success' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
              </div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
                {responseModal.type === 'success' ? 'สำเร็จ' : 'เกิดข้อผิดพลาด'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
                {responseModal.message}
              </p>
              <button
                onClick={() => setResponseModal(null)}
                style={{ padding: '0.75rem 2rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
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

export default OfficeEquipmentManagement;
