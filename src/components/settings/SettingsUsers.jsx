import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Edit2, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '../equipment-form/ConfirmDialog.jsx';
import { API, ROLES, roleLabel, roleTone, settingsPermissions, fullName, failureMessage, readJson, writeJson, loadUsers } from './settingsShared';
import '../ListPage.css';
import '../AdminSettings.css';

const VIEW_KEY = 'settings_users_view.v1';
const PAGE_SIZES = [10, 25, 50, 100];
const SORTS = {
  name: { label: 'ผู้ใช้', value: (u) => fullName(u) },
  role: { label: 'สิทธิ์', value: (u) => ROLES.findIndex((r) => r.value === u.role) },
  branch: { label: 'สังกัด', value: (u) => u.pea_branch || '' },
  createdAt: { label: 'สร้างเมื่อ', value: (u) => new Date(u.createdAt).getTime() || 0 }
};

const readView = () => {
  const v = readJson(VIEW_KEY, {}) || {};
  return {
    search: typeof v.search === 'string' ? v.search.slice(0, 200) : '',
    role: ROLES.some((r) => r.value === v.role) ? v.role : '',
    pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 25,
    page: Number.isSafeInteger(v.page) && v.page > 0 ? v.page : 1,
    sort: SORTS[v.sort?.key] && ['asc', 'desc'].includes(v.sort?.order) ? v.sort : { key: 'name', order: 'asc' }
  };
};

export default function SettingsUsers({ token, currentUser, onBack, onEdit }) {
  const perms = settingsPermissions(currentUser);
  const [view] = useState(readView);
  const [search, setSearch] = useState(view.search);
  const [role, setRole] = useState(view.role);
  const [pageSize, setPageSize] = useState(view.pageSize);
  const [page, setPage] = useState(view.page);
  const [sort, setSort] = useState(view.sort);
  const [state, setState] = useState({ status: 'loading', users: [], error: '' });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const inflight = useRef(null);

  useEffect(() => { writeJson(VIEW_KEY, { search, role, pageSize, page, sort }); }, [search, role, pageSize, page, sort]);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setState((s) => ({ ...s, status: s.users.length ? 'refreshing' : 'loading' }));
    try {
      const users = await loadUsers(token, controller.signal);
      if (inflight.current === controller) setState({ status: 'ready', users, error: '' });
    } catch (err) {
      if (inflight.current !== controller) return;
      const message = err.name === 'AbortError' ? 'หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์' : err.message;
      setState((s) => ({ ...s, status: s.users.length ? 'stale' : 'error', error: message }));
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => { const c = inflight.current; inflight.current = null; c?.abort(); };
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = state.users.filter((u) => (!role || u.role === role)
    && (!q || [u.username, u.first_name, u.last_name, u.pea_branch, u.pea_division].some((v) => String(v ?? '').toLowerCase().includes(q))));
  const get = SORTS[sort.key].value;
  const sorted = [...filtered].sort((a, b) => {
    const [x, y] = [get(a), get(b)];
    const cmp = typeof x === 'string' ? x.localeCompare(y, 'th') : x - y;
    return sort.order === 'asc' ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = sorted.slice((current - 1) * pageSize, current * pageSize);
  const filtering = Boolean(q || role);
  const clear = () => { setSearch(''); setRole(''); setPage(1); };

  const sortHeader = (key) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="list-sort" onClick={() => { setSort((s) => ({ key, order: s.key === key && s.order === 'asc' ? 'desc' : 'asc' })); setPage(1); }}>
        {SORTS[key].label}
        {sort.key !== key ? <ArrowUpDown size={14} aria-hidden="true" className="as-sort-idle" /> : sort.order === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );

  // Why a row can't be changed, so the reason is readable instead of a
  // silently disabled button.
  const lockReason = (u) => {
    if (!perms.canEditUsers) return 'ดูได้อย่างเดียว';
    if (u.role === 'super_admin') return 'บัญชีผู้ดูแลระบบสูงสุดถูกป้องกัน';
    return '';
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(`${API}/api/auth/users/${toDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(failureMessage(response, result, 'ลบผู้ใช้ไม่สำเร็จ'));
      toast.success(`ลบบัญชี @${toDelete.username} แล้ว`);
      setToDelete(null);
      load();
    } catch (err) {
      setDeleteError(err.message === 'Failed to fetch' ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ บัญชียังไม่ถูกลบ' : err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="list-page as-page">
      <button type="button" className="list-button as-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> กลับไปหน้าการตั้งค่าระบบ</button>
      <header className="list-header">
        <div>
          <h1>ผู้ใช้และสิทธิ์</h1>
          <p>{perms.canEditUsers ? 'แก้ไขชื่อ สังกัด สิทธิ์ และรหัสผ่านของผู้ใช้ · บัญชีผู้ดูแลระบบสูงสุดแก้ไขและลบจากหน้านี้ไม่ได้' : 'บัญชีนี้ดูรายชื่อผู้ใช้ได้อย่างเดียว'}</p>
        </div>
        <div className="list-actions">
          <button type="button" className="list-button" onClick={load} disabled={state.status === 'loading' || state.status === 'refreshing'}>
            <RefreshCw size={18} aria-hidden="true" className={state.status === 'refreshing' ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
      </header>

      {(state.status === 'error' || state.status === 'stale') && (
        <div className="list-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>{state.status === 'stale' ? 'รีเฟรชไม่สำเร็จ แสดงข้อมูลเดิม' : 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ'}</strong><p>{state.error}</p></div>
          <button type="button" className="list-button" onClick={load}>ลองใหม่</button>
        </div>
      )}

      <section className="list-panel" aria-label="รายชื่อผู้ใช้">
        <div className="list-toolbar">
          <label className={`list-field list-search${search ? ' is-active' : ''}`}>
            <span>ค้นหา</span>
            <div className="list-search-input">
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="ชื่อ ชื่อผู้ใช้ หรือสังกัด" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </label>
          <label className={`list-field${role ? ' is-active' : ''}`}>
            <span>สิทธิ์</span>
            <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              <option value="">ทุกสิทธิ์</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {filtering && <button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button>}
        </div>
        {state.users.length > 0 && (
          <div className="list-result-info"><span role="status">{filtering ? `พบ ${sorted.length} จาก ${state.users.length} บัญชี` : `ทั้งหมด ${state.users.length} บัญชี`}</span></div>
        )}

        {state.status === 'loading' ? (
          <div className="as-state" role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>กำลังโหลดรายชื่อผู้ใช้…</p></div>
        ) : state.users.length === 0 ? (
          state.status === 'error' ? null : <div className="as-state"><p>ยังไม่มีบัญชีผู้ใช้</p></div>
        ) : sorted.length === 0 ? (
          <div className="as-state"><p><strong>ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</strong></p><button type="button" className="list-button" onClick={clear}>ล้างตัวกรอง</button></div>
        ) : (
          <div className="list-table-scroll" tabIndex={0} role="region" aria-label="ตารางผู้ใช้ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์">
            <table className="list-table as-table">
              <caption className="list-sr-only">รายชื่อผู้ใช้ หน้า {current} จาก {totalPages}</caption>
              <thead>
                <tr>
                  {sortHeader('name')}
                  {sortHeader('role')}
                  {sortHeader('branch')}
                  {sortHeader('createdAt')}
                  <th scope="col" className="as-actions-col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const lock = lockReason(u);
                  const isSelf = String(u.id) === String(currentUser?.id);
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="as-cell-main" title={fullName(u)}>{fullName(u)}{isSelf && <span className="as-self"> (บัญชีของคุณ)</span>}</span>
                        <span className="list-muted">@{u.username}</span>
                      </td>
                      <td><span className={`list-status list-status-${roleTone(u.role)}`}>{roleLabel(u.role)}</span></td>
                      <td>
                        <span className="as-cell-main as-clip" title={u.pea_branch || ''}>{u.pea_branch || '—'}</span>
                        <span className="list-muted as-clip" title={u.pea_division || ''}>{u.pea_division || 'ไม่ระบุแผนก'}</span>
                      </td>
                      <td className="list-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '—'}</td>
                      <td>
                        {lock ? (
                          <span className="list-muted">{lock}</span>
                        ) : (
                          <div className="as-row-actions">
                            <a
                              className="as-icon"
                              href={`/settings/users/${u.id}`}
                              aria-label={`แก้ไขผู้ใช้ @${u.username}`}
                              title="แก้ไข"
                              onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onEdit(u.id); } }}
                            ><Edit2 size={18} aria-hidden="true" /></a>
                            {isSelf ? (
                              <span className="as-icon is-disabled" title="ลบบัญชีของตัวเองไม่ได้"><Trash2 size={18} aria-hidden="true" /><span className="list-sr-only">ลบบัญชีของตัวเองไม่ได้</span></span>
                            ) : (
                              <button type="button" className="as-icon is-danger" onClick={() => { setDeleteError(''); setToDelete(u); }} aria-label={`ลบผู้ใช้ @${u.username}`} title="ลบ"><Trash2 size={18} aria-hidden="true" /></button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sorted.length > 0 && (
          <footer className="list-footer">
            <span className="list-muted">{(current - 1) * pageSize + 1}–{(current - 1) * pageSize + rows.length} จาก {sorted.length} บัญชี</span>
            <label className="list-page-size">
              แสดง
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              รายการต่อหน้า
            </label>
            <nav className="list-pagination" aria-label="แบ่งหน้ารายชื่อผู้ใช้">
              <button type="button" className="list-button" disabled={current <= 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button>
              <span className="list-muted">หน้า {current} / {totalPages}</span>
              <button type="button" className="list-button" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>ถัดไป</button>
            </nav>
          </footer>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="ลบบัญชีผู้ใช้นี้?"
        tone="danger"
        busy={deleting}
        confirmLabel={deleting ? 'กำลังลบ…' : 'ลบบัญชี'}
        cancelLabel="ไม่ลบ"
        message={toDelete && (
          <>
            <p className="as-confirm-target">{fullName(toDelete)} · @{toDelete.username} · {roleLabel(toDelete.role)}</p>
            <p>บัญชีนี้พร้อมสิทธิ์และสังกัดจะถูกลบออกจากระบบ และกู้คืนจากหน้านี้ไม่ได้</p>
            {deleteError && <p className="as-confirm-error" role="alert">{deleteError}</p>}
          </>
        )}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
