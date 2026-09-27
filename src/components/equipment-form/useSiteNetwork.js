import { useEffect, useState } from 'react';

const cache = new Map();

// The site endpoint returns that office's network ranges alongside its
// equipment list; there is no lighter endpoint for network context yet.
export default function useSiteNetwork(siteId, { known, token } = {}) {
  const id = siteId ? String(siteId) : '';
  const [state, setState] = useState({ siteId: '', status: 'idle', network: null, error: '' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!id || known) return undefined;
    if (cache.has(id)) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    // setState in the async chain only; the synchronous "loading" is derived below.
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/office-equipment/site/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal
    })
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || body.success === false) throw new Error(`โหลดข้อมูลวงเครือข่ายไม่สำเร็จ (HTTP ${res.status})`);
        const network = body.network_ip && typeof body.network_ip === 'object' ? body.network_ip : null;
        cache.set(id, network);
        if (!cancelled) setState({ siteId: id, status: 'ready', network, error: '' });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ siteId: id, status: 'error', network: null, error: timedOut ? 'หมดเวลาโหลดข้อมูลวงเครือข่าย' : err.message });
      })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [id, known, token, retry]);

  if (!id) return { status: 'idle', network: null, error: '', retry: () => {} };
  if (known) return { status: 'ready', network: known, error: '', retry: () => {} };
  if (cache.has(id)) return { status: 'ready', network: cache.get(id), error: '', retry: () => {} };
  // A result belonging to a previously selected site is never shown for this one.
  if (state.siteId !== id) return { status: 'loading', network: null, error: '', retry: () => {} };
  return { ...state, retry: () => { setState(s => ({ ...s, siteId: '' })); setRetry(n => n + 1); } };
}
