import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2, Search, Building2, ChevronRight, ChevronLeft, Monitor as MonitorIcon } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import OfficeSiteEquipment from './OfficeSiteEquipment';

// Office list (/management/computers) and, once an office is selected
// (/management/computers/:siteId), that office's equipment view.
const OfficeEquipmentManagement = ({ token, onBack, user, selectedSiteId = null, onSelectSite }) => {
  const view = selectedSiteId ? 'detail' : 'sites';
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesSummary, setSitesSummary] = useState([]);
  const [siteSearch, setSiteSearch] = useState('');
  // Client-side pagination -- /api/pea-sites/summary returns the whole list.
  const [sitesPage, setSitesPage] = useState(1);
  const [sitesPerPage, setSitesPerPage] = useState(20);

  const fetchSitesSummary = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-sites/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      const list = result.data || result || [];
      setSitesSummary(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error fetching PEA sites summary:', error);
      toast.error('ไม่สามารถโหลดรายชื่อสำนักงานการไฟฟ้าได้');
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchSitesSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sites = React.useMemo(() =>
    sitesSummary.map(s => ({ id: s.id, pea_name: s.pea_name, pea_province: s.pea_province, count: s.equipment_count || 0 })),
  [sitesSummary]);

  const filteredSites = React.useMemo(() => {
    if (!siteSearch) return sites;
    const q = siteSearch.toLowerCase();
    return sites.filter(s =>
      (s.pea_name && s.pea_name.toLowerCase().includes(q)) ||
      (s.pea_province && s.pea_province.toLowerCase().includes(q))
    );
  }, [sites, siteSearch]);

  const sitesTotalPages = Math.max(1, Math.ceil(filteredSites.length / sitesPerPage));
  const paginatedSites = React.useMemo(
    () => filteredSites.slice((sitesPage - 1) * sitesPerPage, sitesPage * sitesPerPage),
    [filteredSites, sitesPage, sitesPerPage]
  );

  const selectedSite = React.useMemo(
    () => sites.find(s => String(s.id) === String(selectedSiteId)) || null,
    [sites, selectedSiteId]
  );

  const handleSiteClick = (site) => onSelectSite && onSelectSite(site.id);

  return (
    <Motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
      <AnimatePresence mode="wait">
        {view === 'sites' ? (
          <Motion.div key="sites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                  onChange={(e) => { setSiteSearch(e.target.value); setSitesPage(1); }}
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
                      paginatedSites.map(site => (
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

              {/* Pagination -- client-side, since /api/pea-sites/summary
                  returns the whole ~200-site list in one shot. */}
              {!loadingSites && filteredSites.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    แสดง {(sitesPage - 1) * sitesPerPage + 1} ถึง {Math.min(sitesPage * sitesPerPage, filteredSites.length)} จาก {filteredSites.length} รายการ
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      value={sitesPerPage}
                      onChange={(e) => { setSitesPerPage(Number(e.target.value)); setSitesPage(1); }}
                      className="glass"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.3rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                    >
                      {[10, 20, 50, 100].map(n => (
                        <option key={n} value={n} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>แสดง {n}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => setSitesPage(p => Math.max(1, p - 1))} disabled={sitesPage === 1} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: sitesPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
                      <select
                        value={sitesPage}
                        onChange={(e) => setSitesPage(Number(e.target.value))}
                        className="glass"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                      >
                        {Array.from({ length: sitesTotalPages }, (_, i) => i + 1).map(p => (
                          <option key={p} value={p} style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>หน้า {p} จาก {sitesTotalPages}</option>
                        ))}
                      </select>
                      <button onClick={() => setSitesPage(p => Math.min(sitesTotalPages, p + 1))} disabled={sitesPage === sitesTotalPages} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', opacity: sitesPage === sitesTotalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Motion.div>
        ) : (
          <Motion.div key={`detail-${selectedSiteId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OfficeSiteEquipment
              key={selectedSiteId}
              siteId={selectedSiteId}
              site={selectedSite}
              token={token}
              user={user}
              onBackToSites={() => onSelectSite && onSelectSite(null)}
              onMutated={fetchSitesSummary}
            />
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

export default OfficeEquipmentManagement;
