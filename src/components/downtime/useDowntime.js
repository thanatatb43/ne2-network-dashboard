import { useEffect, useRef, useState } from 'react';
import { filterParams, persist, request, stored } from './downtimeData';

export default function useDowntime(filters, token) {
  const [resources, setResources] = useState({});
  const [revision, setRevision] = useState(0);
  const snapshot = useRef(null);
  const key = filterParams(filters).toString();
  const listKey = `${key}&page=${filters.page}&sort_by=${filters.sort}&sort_order=${filters.order}`;
  const summaryKey = useRef('');
  const dashboardKey = useRef('');
  const page = filters.page, sort = filters.sort, order = filters.order;
  const refresh = () => { snapshot.current = null; summaryKey.current = ''; persist({ snapshot: null }); setRevision(v => v + 1); };
  const retry = () => { summaryKey.current = ''; setRevision(v => v + 1); };
  useEffect(() => {
    const controller = new AbortController();
    let expired = false;
    const update = (name, value) => {
      if (!controller.signal.aborted) setResources(prev => ({ ...prev, [name]: value.retain && prev[name]?.key === value.key
        ? { ...prev[name], ...value, stale: Boolean(prev[name]?.data) } : value }));
    };
    const run = async () => {
      if (!snapshot.current) {
        const saved = stored().snapshot;
        if (/^[a-f0-9]{64}$/i.test(saved?.token || '') && Date.parse(saved?.expires) > Date.now() + 5000) snapshot.current = saved;
      }
      const full = summaryKey.current !== key || dashboardKey.current !== key || !snapshot.current || Date.parse(snapshot.current.expires) <= Date.now() + 5000;
      if (snapshot.current && Date.parse(snapshot.current.expires) <= Date.now() + 5000) snapshot.current = null;
      update('list', { key: listKey, loading: true, error: null, retain: true });
      if (full) {
        dashboardKey.current = '';
        update('summary', { key, loading: true, error: null, retain: true }); update('dashboard', { key, loading: true, error: null, retain: true });
      }
      const fail = (name, error, resourceKey) => {
        if (controller.signal.aborted) return;
        if (error.status === 410 || error.code === 'INVALID_SNAPSHOT') {
          expired = true; snapshot.current = null; summaryKey.current = ''; persist({ snapshot: null });
          for (const part of ['summary', 'dashboard', 'list']) update(part, { key: part === 'list' ? listKey : key, error: error.message });
          controller.abort();
        } else update(name, { key: resourceKey, loading: false, retain: true, error: error.message || 'โหลดข้อมูลไม่สำเร็จ' });
      };
      try {
        if (full) {
          const params = new URLSearchParams(key); params.set('contract', 'v2');
          if (snapshot.current) params.set('snapshot_token', snapshot.current.token);
          const result = await request('summary', params, controller.signal, token);
          if (!Number.isSafeInteger(result.data.matched_incident_count) || result.data.matched_incident_count < 0) throw new Error('รูปแบบยอดสรุปไม่ถูกต้อง');
          if (controller.signal.aborted) return;
          snapshot.current = { token: result.meta.snapshot_token, expires: result.meta.snapshot_expires_at };
          persist({ snapshot: snapshot.current }); summaryKey.current = key;
          // Once the new summary arrives, discard old dependent panels before
          // publishing it so data from two snapshots are never displayed together.
          update('list', { key: listKey, loading: true });
          update('dashboard', { key, loading: true });
          update('summary', { key, ...result });
        }
      } catch (error) {
        fail('summary', error, key);
        if (!snapshot.current && !expired && !controller.signal.aborted) {
          update('dashboard', { key, loading: false, retain: true, error: 'ยังโหลดข้อมูลชุดใหม่ไม่ได้ กรุณาลองใหม่' });
          update('list', { key: listKey, loading: false, retain: true, error: 'ยังโหลดข้อมูลชุดใหม่ไม่ได้ กรุณาลองใหม่' }); return;
        }
      }
      if (controller.signal.aborted || !snapshot.current) return;
      const shared = new URLSearchParams(key); shared.set('snapshot_token', snapshot.current.token);
      const listParams = new URLSearchParams(shared); listParams.set('page', page); listParams.set('page_size', '15'); listParams.set('sort_by', sort); listParams.set('sort_order', order);
      const jobs = [request('incidents', listParams, controller.signal, token).then(result => {
        if (!Array.isArray(result.data.items) || !['total_items', 'total_pages', 'page', 'page_size'].every(k => Number.isSafeInteger(result.data.pagination?.[k]) && result.data.pagination[k] >= 0)) throw new Error('รูปแบบรายการไม่ถูกต้อง');
        update('list', { key: listKey, ...result });
      }).catch(e => fail('list', e, listKey))];
      if (full) {
        const dashParams = new URLSearchParams(shared); dashParams.set('contract', 'v2');
        jobs.push(request('dashboard', dashParams, controller.signal, token).then(result => {
          if (!Array.isArray(result.data.daily) || !Array.isArray(result.data.monthly) || !Array.isArray(result.data.top_devices)) throw new Error('รูปแบบกราฟไม่ถูกต้อง');
          if (controller.signal.aborted) return;
          dashboardKey.current = key;
          update('dashboard', { key, ...result });
        }).catch(e => fail('dashboard', e, key)));
      }
      await Promise.allSettled(jobs);
    };
    // React StrictMode replays effects: defer creation so the discarded mount
    // cannot create a second expensive backend snapshot.
    const start = setTimeout(run, 0);
    return () => { clearTimeout(start); controller.abort(); };
  }, [key, listKey, page, sort, order, revision, token]);
  const current = (name, resourceKey) => resources[name]?.key === resourceKey ? resources[name] : { loading: true };
  return { summary: current('summary', key), dashboard: current('dashboard', key), list: current('list', listKey), refresh, retry };
}
