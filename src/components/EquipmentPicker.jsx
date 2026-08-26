import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, Check, X } from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '0.6rem 1rem', background: 'var(--input-bg)',
  border: '1px solid var(--input-border)', color: 'var(--text-primary)',
  borderRadius: '0.5rem', outline: 'none', fontSize: '0.9rem'
};

// Search-and-select equipment picker scoped to one PEA site, extracted from
// JobFormModal.jsx's original inline problem-equipment picker since it's
// now needed twice (problem_equipment at open time, equipment used for
// repair at close time) -- same search box + result list + selected-chip
// shape either way, only the caller's label/hint text differs.
//
// Fetches only on an explicit "ค้นหา" click (or Enter in the box), not on
// mount/site-change -- opening the form shouldn't silently pull the site's
// whole equipment list before the user has asked for anything.
const EquipmentPicker = ({ siteId, token, selected, onChange, emptySiteHint }) => {
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // A stale result set from a previous site would be misleading once the
  // site changes, so clear back to the "not searched yet" state.
  useEffect(() => {
    setResults(null);
    setSearchInput('');
  }, [siteId]);

  const runSearch = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('pea_site_id', siteId);
      params.append('limit', '20');
      if (searchInput.trim()) params.append('search', searchInput.trim());
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      setResults(result.data || []);
    } catch (error) {
      console.error('Error fetching equipment for picker:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Enter-to-search, without submitting whatever outer <form> this picker
  // is embedded in (JobFormModal.jsx / JobManagement.jsx's ปิดงาน form).
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  };

  const isSelected = (item) => selected.some(e => e.id === item.id);
  const toggle = (item) => {
    onChange(isSelected(item) ? selected.filter(e => e.id !== item.id) : [...selected, item]);
  };
  const remove = (id) => onChange(selected.filter(e => e.id !== id));

  return (
    <>
      {!siteId ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{emptySiteHint || 'เลือกสำนักงาน ก่อน จึงจะค้นหาอุปกรณ์ของสาขานั้นได้'}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="ค้นหาอุปกรณ์ในสาขานี้..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, padding: '0.5rem 0.75rem 0.5rem 2.25rem', fontSize: '0.85rem' }}
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              className="glass"
              style={{ padding: '0.5rem 0.9rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
            </button>
          </div>
          {results !== null && (
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {results.length === 0 ? (
                <p style={{ margin: '0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ไม่พบอุปกรณ์</p>
              ) : (
                results.map(item => {
                  const isSel = isSelected(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggle(item)}
                      className="glass"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem',
                        borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem',
                        border: isSel ? '1px solid var(--accent-primary)' : undefined,
                        background: isSel ? 'var(--bg-accent-subtle)' : undefined
                      }}
                    >
                      <span>{item.name || '-'} <span style={{ color: 'var(--text-secondary)' }}>({item.equipment_type || '-'})</span></span>
                      {isSel ? <Check size={14} style={{ color: 'var(--accent-primary)' }} /> : <Plus size={14} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {selected.map(item => (
            <span key={item.id} className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem' }}>
              {item.name || '-'}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => remove(item.id)} />
            </span>
          ))}
        </div>
      )}
    </>
  );
};

export default EquipmentPicker;
