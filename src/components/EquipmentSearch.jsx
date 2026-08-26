import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Loader2, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';

// Same fixed option lists EquipmentBorrow.jsx uses, duplicated here since
// they aren't exported from that file.
const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];
const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];
const STATUS_OPTIONS = ['ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย', 'ถูกยืม'];

// Advanced (less commonly used) text filters -- sent as-is in the POST body,
// substring-matched server-side. Kept separate from the primary filter row
// so the common case (name/type/department/status/site) doesn't get
// crowded out by long-tail fields like MAC address or contract number.
const ADVANCED_FIELDS = [
  { key: 'vendor', label: 'ผู้ผลิต/ตัวแทนจำหน่าย' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_number', label: 'รหัสทรัพย์สิน' },
  { key: 'asset_owner', label: 'ผู้ถือครอง' },
  { key: 'asset_owner_emp_id', label: 'รหัสพนักงานผู้ถือครอง' },
  { key: 'storage_location', label: 'สถานที่จัดเก็บ' },
  { key: 'ip_address', label: 'IP Address' },
  { key: 'mac_address', label: 'MAC Address' },
  { key: 'contract_no', label: 'เลขที่สัญญา' },
  { key: 'notes', label: 'หมายเหตุ' }
];

const buildImageUrl = (path) => path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null;

const statusColor = (status) => {
  const s = (status || '').trim();
  if (s === 'ใช้งาน') return 'var(--accent-success)';
  if (s === 'รอปรับปรุง' || s === 'รอจำหน่าย') return 'var(--accent-warning)';
  if (s === 'เลิกใช้งาน' || s === 'จำหน่าย') return 'var(--accent-danger)';
  if (s === 'ถูกยืม') return '#a855f7';
  return 'var(--text-secondary)';
};

const inputStyle = {
  padding: '0.6rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none'
};

const emptyAdvanced = ADVANCED_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

// Clicking a result navigates to EquipmentDetails.jsx through a different
// top-level tab in App.jsx, which unmounts EquipmentSearch entirely -- a
// plain useState for the search filters was wiped out by that navigation,
// so clicking back landed on a blank search. Persisted through
// sessionStorage instead, same pattern StockManagement.jsx uses for its own
// filters/selection.
const NAME_KEY = 'eq_search_name';
const PRIMARY_KEY = 'eq_search_primary';
const SITE_INPUT_KEY = 'eq_search_site_input';
const ADVANCED_KEY = 'eq_search_advanced';
const SHOW_ADVANCED_KEY = 'eq_search_show_advanced';

const readSavedJson = (key, fallback) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    return saved && typeof saved === 'object' ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
};

const EquipmentSearch = ({ token, onEquipmentClick }) => {
  const [equipment, setEquipment] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [nameInput, setNameInput] = useState(() => sessionStorage.getItem(NAME_KEY) || '');
  const [name, setName] = useState(() => sessionStorage.getItem(NAME_KEY) || '');

  // ประเภท/แผนก/สถานะ are typeable (substring-matched server-side) via a
  // native <input list> + <datalist> combo instead of a plain <select>, so
  // the user can filter the option list by typing instead of scrolling it.
  const emptyPrimary = { equipment_type: '', department: '', status: '' };
  const [primaryInputs, setPrimaryInputs] = useState(() => readSavedJson(PRIMARY_KEY, emptyPrimary));
  const [primaryFilters, setPrimaryFilters] = useState(() => readSavedJson(PRIMARY_KEY, emptyPrimary));

  // สำนักงาน is an FK (pea_site_id) -- the datalist shows site names, but
  // only an exact match against a known site's label resolves to an id that
  // actually gets sent as a filter. Free typing that doesn't match a real
  // site yet just doesn't filter by site (rather than sending a bogus id).
  const [siteInput, setSiteInput] = useState(() => sessionStorage.getItem(SITE_INPUT_KEY) || '');
  const [siteFilterId, setSiteFilterId] = useState('');
  const [sites, setSites] = useState([]);
  const siteLabel = (s) => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;

  const [showAdvanced, setShowAdvanced] = useState(() => sessionStorage.getItem(SHOW_ADVANCED_KEY) === '1');
  const [advancedInputs, setAdvancedInputs] = useState(() => readSavedJson(ADVANCED_KEY, emptyAdvanced));
  const [advanced, setAdvanced] = useState(() => readSavedJson(ADVANCED_KEY, emptyAdvanced));

  const advancedActiveCount = Object.values(advanced).filter(Boolean).length;
  const anyFilterActive = !!(
    name || primaryFilters.equipment_type || primaryFilters.department || primaryFilters.status ||
    siteFilterId || advancedActiveCount > 0
  );

  const fetchSites = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/sites`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const result = await response.json();
      const list = result.data || result || [];
      setSites(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites:', error);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    try {
      const body = { page: currentPage, limit: itemsPerPage };
      if (name.trim()) body.name = name.trim();
      if (primaryFilters.equipment_type) body.equipment_type = primaryFilters.equipment_type;
      if (primaryFilters.department) body.department = primaryFilters.department;
      if (primaryFilters.status) body.status = primaryFilters.status;
      if (siteFilterId) body.pea_site_id = Number(siteFilterId);
      ADVANCED_FIELDS.forEach(({ key }) => {
        if (advanced[key] && advanced[key].trim()) body[key] = advanced[key].trim();
      });

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (result.success) {
        setEquipment(result.data || []);
        if (result.pagination) setPagination(result.pagination);
      } else {
        toast.error(result.message || 'ค้นหาไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error searching office equipment:', error);
      toast.error('ไม่สามารถค้นหาอุปกรณ์ได้');
    } finally {
      setHasSearched(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasSearched) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage, name, primaryFilters, siteFilterId, advanced]);

  // Debounces the free-text name field, the ประเภท/แผนก/สถานะ inputs, the
  // site input, and the whole advanced-filter object into committed values,
  // batching each with the page-1 reset so they land together instead of
  // racing across separate effects.
  useEffect(() => {
    const t = setTimeout(() => {
      setName(nameInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [nameInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPrimaryFilters(primaryInputs);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [primaryInputs]);

  // Only resolves to a real pea_site_id once the typed text exactly matches
  // a known site's label (i.e. the user picked a datalist suggestion or
  // typed the full name) -- partial text just leaves the site filter unset.
  useEffect(() => {
    const t = setTimeout(() => {
      const match = sites.find(s => siteLabel(s) === siteInput);
      setSiteFilterId(match ? String(match.id) : '');
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [siteInput, sites]);

  useEffect(() => {
    const t = setTimeout(() => {
      setAdvanced(advancedInputs);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [advancedInputs]);

  useEffect(() => {
    sessionStorage.setItem(NAME_KEY, nameInput);
  }, [nameInput]);
  useEffect(() => {
    sessionStorage.setItem(PRIMARY_KEY, JSON.stringify(primaryInputs));
  }, [primaryInputs]);
  useEffect(() => {
    sessionStorage.setItem(SITE_INPUT_KEY, siteInput);
  }, [siteInput]);
  useEffect(() => {
    sessionStorage.setItem(ADVANCED_KEY, JSON.stringify(advancedInputs));
  }, [advancedInputs]);
  useEffect(() => {
    sessionStorage.setItem(SHOW_ADVANCED_KEY, showAdvanced ? '1' : '0');
  }, [showAdvanced]);

  const handlePrimaryChange = (key) => (value) => {
    setPrimaryInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleAdvancedChange = (key) => (value) => {
    setAdvancedInputs(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setNameInput('');
    setName('');
    setPrimaryInputs(emptyPrimary);
    setPrimaryFilters(emptyPrimary);
    setSiteInput('');
    setSiteFilterId('');
    setAdvancedInputs(emptyAdvanced);
    setAdvanced(emptyAdvanced);
    setCurrentPage(1);
  };

  return (
    <motion.div
      key="equipment-search"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>ค้นหาอุปกรณ์คอมพิวเตอร์</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>ค้นหาอุปกรณ์คอมพิวเตอร์ ด้วย รหัสทรัพย์สิน, Serial Number, หรือรายละเอียดอื่นๆ</p>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="ค้นหาชื่ออุปกรณ์..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                ...inputStyle, width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem',
                border: nameInput ? '1px solid var(--accent-primary)' : inputStyle.border,
                background: nameInput ? 'var(--bg-accent-subtle)' : inputStyle.background
              }}
            />
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: primaryInputs.equipment_type ? '1px solid var(--accent-primary)' : undefined,
            background: primaryInputs.equipment_type ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>ประเภท:</span>
            <input
              type="text"
              list="eq-search-type-options"
              placeholder="ทั้งหมด"
              value={primaryInputs.equipment_type}
              onChange={(e) => handlePrimaryChange('equipment_type')(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '110px' }}
            />
            <datalist id="eq-search-type-options">
              {EQUIPMENT_TYPE_OPTIONS.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: primaryInputs.department ? '1px solid var(--accent-primary)' : undefined,
            background: primaryInputs.department ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>แผนก:</span>
            <input
              type="text"
              list="eq-search-department-options"
              placeholder="ทั้งหมด"
              value={primaryInputs.department}
              onChange={(e) => handlePrimaryChange('department')(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '100px' }}
            />
            <datalist id="eq-search-department-options">
              {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: primaryInputs.status ? '1px solid var(--accent-primary)' : undefined,
            background: primaryInputs.status ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
            <input
              type="text"
              list="eq-search-status-options"
              placeholder="ทั้งหมด"
              value={primaryInputs.status}
              onChange={(e) => handlePrimaryChange('status')(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '100px' }}
            />
            <datalist id="eq-search-status-options">
              {STATUS_OPTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="glass" style={{
            display: 'flex', alignItems: 'center', padding: '0.4rem 0.8rem', gap: '0.5rem', borderRadius: '0.5rem',
            border: siteInput ? '1px solid var(--accent-primary)' : undefined,
            background: siteInput ? 'var(--bg-accent-subtle)' : undefined
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สำนักงาน:</span>
            <input
              type="text"
              list="eq-search-site-options"
              placeholder="ทั้งหมด"
              value={siteInput}
              onChange={(e) => setSiteInput(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, width: '180px' }}
            />
            <datalist id="eq-search-site-options">
              {sites.map(s => <option key={s.id} value={siteLabel(s)} />)}
            </datalist>
          </div>

          <button
            onClick={() => setShowAdvanced(prev => !prev)}
            className="glass"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '0.5rem',
              border: advancedActiveCount > 0 ? '1px solid var(--accent-primary)' : undefined,
              background: advancedActiveCount > 0 ? 'var(--bg-accent-subtle)' : undefined,
              color: advancedActiveCount > 0 ? 'var(--accent-primary)' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
            }}
          >
            <SlidersHorizontal size={14} />
            ตัวกรองขั้นสูง{advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ''}
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {anyFilterActive && (
            <button
              onClick={clearAllFilters}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.7rem', borderRadius: '0.5rem', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <X size={14} /> ล้างตัวกรอง
            </button>
          )}

          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            พบ <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pagination.total}</span> รายการ
          </div>
        </div>

        {showAdvanced && (
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', background: 'var(--glass-bg-subtle)' }}>
            {ADVANCED_FIELDS.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</label>
                <input
                  type="text"
                  value={advancedInputs[key]}
                  onChange={(e) => handleAdvancedChange(key)(e.target.value)}
                  style={{
                    ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.85rem',
                    border: advancedInputs[key] ? '1px solid var(--accent-primary)' : inputStyle.border,
                    background: advancedInputs[key] ? 'var(--bg-accent-subtle)' : inputStyle.background
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ชื่ออุปกรณ์</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ประเภท</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>แผนก</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สำนักงาน</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>รหัสทรัพย์สิน / Serial</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ผู้ถือครอง</th>
                <th style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--accent-primary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem' }}>กำลังค้นหา...</p>
                  </td>
                </tr>
              ) : equipment.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                equipment.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => onEquipmentClick && onEquipmentClick(item.id)}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onEquipmentClick ? 'pointer' : 'default' }}
                    className="table-row-hover"
                    title="คลิกเพื่อดูรายละเอียดอุปกรณ์"
                  >
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {item.photos?.[0] && (
                          <img
                            src={buildImageUrl(item.photos[0])}
                            alt=""
                            style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.4rem', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
                          />
                        )}
                        <span>{item.name || '-'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.equipment_type || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>{item.department || '-'}</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                      {item.pea_site ? `${item.pea_site.pea_name}${item.pea_site.pea_province ? ` (${item.pea_site.pea_province})` : ''}` : '-'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.asset_number || '-'}{item.serial_number ? ` / ${item.serial_number}` : ''}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                      <div>{item.asset_owner || '-'}</div>
                      {item.asset_owner_emp_id && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.asset_owner_emp_id}</div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                        fontSize: '0.75rem', fontWeight: 600,
                        color: statusColor(item.status), background: `${statusColor(item.status)}15`
                      }}>
                        {item.status || '-'}
                      </span>
                      {item.current_loan?.borrower_name && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          โดย {item.current_loan.borrower_name}
                        </div>
                      )}
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
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
            >
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {pagination.totalPages}</option>
              ))}
            </select>
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
    </motion.div>
  );
};

export default EquipmentSearch;
