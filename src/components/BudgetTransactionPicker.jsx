import React, { useState, useEffect } from 'react';
import { Search, Loader2, X, Check } from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '0.5rem 0.7rem', background: 'var(--input-bg)',
  border: '1px solid var(--input-border)', color: 'var(--text-primary)',
  borderRadius: '0.5rem', outline: 'none', fontSize: '0.85rem'
};

const labelStyle = { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' };

const RESULTS_PER_PAGE = 10;

// Search-and-multi-select UI for existing budget transactions, adapted from
// BudgetDashboard.jsx's transaction search form (GET .../selectors for
// datalist options, POST .../find for results). No backend field marks a
// transaction as already linked to a job, so results may include ones
// already attached elsewhere -- known limitation, nothing to do about it
// client-side.
const BudgetTransactionPicker = ({ token, selected, onChange }) => {
  const [selectors, setSelectors] = useState({
    year: [], clearing_account_name: [], username: [], reference_doc_no: [], description: []
  });
  const [form, setForm] = useState({ year: '', reference_doc_no: '', description: '', clearing_account_name: '', username: '' });
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchSelectors = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/selectors`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await response.json();
        if (result.success) setSelectors(result.data || selectors);
      } catch (error) {
        console.error('Error fetching transaction selectors:', error);
      }
    };
    fetchSelectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // A plain button + onClick, not a <form onSubmit>, since this component
  // gets embedded inside JobManagement.jsx's ปิดงาน <form> -- nested <form>
  // elements are invalid HTML and browsers silently drop the inner one,
  // which breaks submit handling for both forms.
  const handleSearch = async () => {
    setSearching(true);
    setPage(1);
    try {
      const params = new URLSearchParams();
      if (form.year) params.append('year', form.year);
      if (form.reference_doc_no) params.append('reference_doc_no', form.reference_doc_no);
      if (form.description) params.append('description', form.description);
      if (form.clearing_account_name) params.append('clearing_account_name', form.clearing_account_name);
      if (form.username) params.append('username', form.username);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/find`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const result = await response.json();
      setResults(result.success ? (result.data || []) : []);
    } catch (error) {
      console.error('Error searching budget transactions:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const isSelected = (item) => selected.some(t => t.id === item.id);
  const toggle = (item) => {
    onChange(isSelected(item) ? selected.filter(t => t.id !== item.id) : [...selected, item]);
  };
  const remove = (id) => onChange(selected.filter(t => t.id !== id));

  const totalPages = results ? Math.ceil(results.length / RESULTS_PER_PAGE) : 1;
  const pageResults = results ? results.slice((page - 1) * RESULTS_PER_PAGE, page * RESULTS_PER_PAGE) : [];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <div>
          <label style={labelStyle}>ปีงบประมาณ</label>
          <input type="text" list="budget-picker-years" value={form.year} onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))} style={inputStyle} />
          <datalist id="budget-picker-years">{selectors.year?.map(y => <option key={y} value={y} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>เลขที่เอกสาร</label>
          <input type="text" list="budget-picker-refdoc" value={form.reference_doc_no} onChange={(e) => setForm(f => ({ ...f, reference_doc_no: e.target.value }))} style={inputStyle} />
          <datalist id="budget-picker-refdoc">{selectors.reference_doc_no?.map((v, i) => <option key={i} value={v} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>รายละเอียด</label>
          <input type="text" list="budget-picker-desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} style={inputStyle} />
          <datalist id="budget-picker-desc">{selectors.description?.map((v, i) => <option key={i} value={v} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>บัญชีหักล้าง</label>
          <input type="text" list="budget-picker-account" value={form.clearing_account_name} onChange={(e) => setForm(f => ({ ...f, clearing_account_name: e.target.value }))} style={inputStyle} />
          <datalist id="budget-picker-account">{selectors.clearing_account_name?.map((v, i) => <option key={i} value={v} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>ผู้บันทึก</label>
          <input type="text" list="budget-picker-username" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} style={inputStyle} />
          <datalist id="budget-picker-username">{selectors.username?.map((v, i) => <option key={i} value={v} />)}</datalist>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={handleSearch} disabled={searching} className="glass" style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
          </button>
        </div>
      </div>

      {results !== null && (
        <div style={{ marginBottom: '0.75rem' }}>
          {results.length === 0 ? (
            <p style={{ margin: '0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ไม่พบธุรกรรมที่ตรงกับเงื่อนไข</p>
          ) : (
            <>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-bg-subtle)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', width: '30px' }}></th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>เลขที่เอกสาร</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>รายละเอียด</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>ผู้บันทึก</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageResults.map(item => {
                      const isSel = isSelected(item);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => toggle(item)}
                          style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', background: isSel ? 'var(--bg-accent-subtle)' : undefined }}
                        >
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {isSel ? <Check size={14} style={{ color: 'var(--accent-primary)' }} /> : <span style={{ display: 'inline-block', width: 14, height: 14, border: '1px solid var(--border-subtle)', borderRadius: '3px' }} />}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{item.reference_doc_no || '-'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>{item.description || '-'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{item.username || '-'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: parseFloat(item.value_co_curr || 0) < 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            ฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="glass" style={{ padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1, fontSize: '0.75rem' }}>ก่อนหน้า</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>หน้า {page} จาก {totalPages}</span>
                  <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="glass" style={{ padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.3 : 1, fontSize: '0.75rem' }}>ถัดไป</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {selected.map(item => (
            <span key={item.id} className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem' }}>
              {item.reference_doc_no || item.id} (฿{parseFloat(item.value_co_curr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => remove(item.id)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default BudgetTransactionPicker;
