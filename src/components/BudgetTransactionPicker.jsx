import { useEffect, useId, useRef, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { amountOf, formatBaht } from './jobReportShared';
import { onBudgetSourceReplaced, inReplacedScope } from './budget/budgetEvents';
import './JobReport.css';
import './JobPickers.css';

const RESULTS_PER_PAGE = 10;
const EMPTY_FORM = { year: '', reference_doc_no: '', description: '', clearing_account_name: '', username: '' };
const FIELDS = [
  { key: 'year', label: 'ปีงบประมาณ' },
  { key: 'reference_doc_no', label: 'เลขที่เอกสาร' },
  { key: 'description', label: 'รายละเอียด' },
  { key: 'clearing_account_name', label: 'บัญชีหักล้าง' },
  { key: 'username', label: 'ผู้บันทึก' }
];

// Search-and-multi-select for existing budget transactions. Keeps the
// original POST /api/budgets/transactions/find (form-urlencoded, returns every
// match for client paging) until the newer endpoint's mapping, paging and
// permissions are confirmed to match. GET .../selectors only feeds the
// suggestion lists, so the form still works when it fails.
//
// A plain button, not a <form>, since this is embedded inside the ปิดงาน
// <form> -- nested forms are invalid HTML and break both submits.
const BudgetTransactionPicker = ({ token, selected, onChange, currentJobId = null }) => {
  const id = useId();
  const [selectors, setSelectors] = useState({ status: 'loading', data: {} });
  const [form, setForm] = useState(EMPTY_FORM);
  // { status: 'idle' | 'loading' | 'error' | 'ready', items, error }
  const [state, setState] = useState({ status: 'idle', items: [] });
  const [page, setPage] = useState(1);
  const [criteriaError, setCriteriaError] = useState('');
  const [replaced, setReplaced] = useState(null);
  const inflight = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/selectors`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || typeof result.data !== 'object') throw new Error();
        setSelectors({ status: 'ready', data: result.data });
      } catch (error) {
        if (error.name !== 'AbortError') setSelectors({ status: 'error', data: {} });
      }
    })();
    return () => controller.abort();
  }, [token]);
  useEffect(() => () => inflight.current?.abort(), []);

  // An upload replaced source transactions (their IDs change): drop what
  // was picked or listed from that account + year and ask for a new search.
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; });
  useEffect(() => onBudgetSourceReplaced((scope) => {
    const dropped = selectedRef.current.filter((t) => inReplacedScope(t, scope));
    if (dropped.length) onChange(selectedRef.current.filter((t) => !inReplacedScope(t, scope)));
    inflight.current?.abort();
    setState({ status: 'idle', items: [] });
    setReplaced({ scope, dropped: dropped.length });
  }), [onChange]);

  const handleSearch = async () => {
    const params = new URLSearchParams();
    FIELDS.forEach(({ key }) => { if (form[key].trim()) params.append(key, form[key].trim()); });
    // Without any condition the endpoint returns every transaction ever
    // recorded -- thousands of rows nobody can pick from.
    if (![...params.keys()].length) { setCriteriaError('ระบุอย่างน้อย 1 เงื่อนไขก่อนค้นหา'); return; }
    setCriteriaError('');
    setReplaced(null);
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/transactions/find`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !Array.isArray(result.data)) throw new Error(result?.message);
      if (inflight.current !== controller) return;
      setState({ status: 'ready', items: result.data });
      setPage(1);
    } catch (error) {
      if (inflight.current !== controller) return;
      setState((s) => ({ ...s, status: 'error', error: error.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : 'ค้นหาธุรกรรมไม่สำเร็จ' }));
    } finally {
      clearTimeout(timer);
    }
  };

  const isSelected = (item) => selected.some((t) => t.id === item.id);
  const toggle = (item) => onChange(isSelected(item) ? selected.filter((t) => t.id !== item.id) : [...selected, item]);
  const remove = (itemId) => onChange(selected.filter((t) => t.id !== itemId));

  const totalPages = Math.max(1, Math.ceil(state.items.length / RESULTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = state.items.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE);
  const selectedTotal = selected.reduce((sum, t) => sum + (amountOf(t) ?? 0), 0);
  const options = (key) => (Array.isArray(selectors.data[key]) ? selectors.data[key] : []);

  return (
    <div className="jp-picker">
      <div className="jp-grid">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className={`jp-field${form[key] ? ' is-active' : ''}`}>
            <label htmlFor={`${id}-${key}`}>{label}</label>
            <input
              id={`${id}-${key}`}
              type="text"
              list={options(key).length ? `${id}-${key}-list` : undefined}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              aria-describedby={criteriaError ? `${id}-criteria` : undefined}
            />
            {options(key).length > 0 && (
              <datalist id={`${id}-${key}-list`}>{options(key).map((v, i) => <option key={i} value={v} />)}</datalist>
            )}
          </div>
        ))}
        <div className="jp-grid-actions">
          <button type="button" className="jp-button" onClick={handleSearch} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />} ค้นหา
          </button>
          {Object.values(form).some(Boolean) && (
            <button type="button" className="jp-link" onClick={() => { setForm(EMPTY_FORM); setCriteriaError(''); }}>ล้างเงื่อนไข</button>
          )}
        </div>
      </div>
      {selectors.status === 'error' && <p className="jp-hint">โหลดรายการแนะนำไม่สำเร็จ ยังพิมพ์เงื่อนไขค้นหาเองได้</p>}

      <div aria-live="polite">
        {replaced && (
          <p className="jp-error" role="alert">
            มีการนำเข้าข้อมูลการเบิกจ่ายของบัญชี {replaced.scope.cost_center} ปี {replaced.scope.year} ใหม่ รหัสธุรกรรมเดิมจึงใช้ไม่ได้
            {replaced.dropped ? ` นำรายการที่เลือกไว้ ${replaced.dropped} รายการออกแล้ว` : ''} กรุณาค้นหาและเลือกใหม่
          </p>
        )}
        {criteriaError && <p className="jp-error" id={`${id}-criteria`} role="alert">{criteriaError}</p>}
        {state.status === 'loading' && <p className="jp-hint">กำลังค้นหา…</p>}
        {state.status === 'error' && (
          <p className="jp-error" role="alert">{state.error} <button type="button" className="jp-link" onClick={handleSearch}>ลองใหม่</button></p>
        )}
        {state.status === 'ready' && (
          <p className="jp-hint">{state.items.length ? `พบ ${state.items.length.toLocaleString('th-TH')} รายการ` : 'ไม่พบธุรกรรมที่ตรงกับเงื่อนไข'}</p>
        )}
      </div>

      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <div className="jp-table-scroll" tabIndex={0} role="region" aria-label="ผลการค้นหาธุรกรรม เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
            <table className="jp-table">
              <caption className="jp-sr-only">ผลการค้นหาธุรกรรม หน้า {currentPage} จาก {totalPages} เลือกช่องหน้ารายการเพื่อผูกกับงาน</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="jp-sr-only">เลือก</span></th>
                  <th scope="col">วันที่ผ่านรายการ</th>
                  <th scope="col">เลขที่เอกสาร</th>
                  <th scope="col">รายละเอียด</th>
                  <th scope="col">ผู้บันทึก</th>
                  <th scope="col" className="jp-num">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const amount = amountOf(item);
                  const linkedElsewhere = item.pea_job_id && String(item.pea_job_id) !== String(currentJobId);
                  return (
                    <tr key={item.id} className={isSelected(item) ? 'is-selected' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected(item)}
                          onChange={() => toggle(item)}
                          aria-label={`เลือกเอกสาร ${item.reference_doc_no || item.id} ${formatBaht(amount)}`}
                        />
                      </td>
                      <td>{item.posting_date || '—'}</td>
                      <td className="jp-mono">{item.reference_doc_no || '—'}</td>
                      <td className="jp-desc" title={item.description}>
                        {item.description || '—'}
                        {linkedElsewhere && <span className="jp-linked">ผูกกับงาน #{item.pea_job_id} แล้ว</span>}
                      </td>
                      <td>{item.username || '—'}</td>
                      <td className={`jp-num job-amount${amount !== null && amount < 0 ? ' is-credit' : ''}`}>{formatBaht(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav className="jp-pages" aria-label="แบ่งหน้าผลการค้นหาธุรกรรม">
              <button type="button" className="jp-button is-quiet" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
              <span>หน้า {currentPage} / {totalPages}</span>
              <button type="button" className="jp-button is-quiet" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
            </nav>
          )}
        </>
      )}

      {selected.length > 0 && (
        <div className="jp-selected">
          <p className="jp-selected-title">เลือกแล้ว {selected.length} รายการ · รวม {formatBaht(selectedTotal)}</p>
          <ul className="jp-chips">
            {selected.map((item) => (
              <li key={item.id} className="jp-chip">
                <span>{item.reference_doc_no || `#${item.id}`} ({formatBaht(amountOf(item))})</span>
                <button type="button" onClick={() => remove(item.id)} aria-label={`นำเอกสาร ${item.reference_doc_no || item.id} ออก`}><X size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BudgetTransactionPicker;
