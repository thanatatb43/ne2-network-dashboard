import { useEffect, useState } from 'react';
import { clampPage } from './officeDashboardState.js';
import { AUTH_ENDPOINTS, DashboardError, REQUEST_TIMEOUT_MS, endpointUrl, errorMessage, fetchDashboard } from './officeDashboardData.js';

// One dashboard widget's request: abort on change/unmount, timeout, retry.
// Each result is stored with the key it was requested for, so an answer to
// an older query (or an older session) can never stand in for the current
// one. The last good data stays visible while a new query loads; `stale`
// says it no longer matches the filters on screen (drill-down/export from
// it must wait).
// `nonce` changes when the page's refresh button is pressed.
export default function useOfficeDashboardResource(endpoint, state, { token = null, enabled = true, nonce = 0 } = {}) {
  const [attempt, setAttempt] = useState(0);
  const needsToken = AUTH_ENDPOINTS.has(endpoint);
  const active = enabled && (!needsToken || Boolean(token));
  const url = endpointUrl(endpoint, state);
  // The token is part of the key: logging out or switching accounts drops
  // what the previous session loaded.
  const key = `${url}#${needsToken ? token : ''}#${attempt}.${nonce}`;
  const [result, setResult] = useState({ key: '', data: null, pagination: null, meta: null, error: null, dataKey: '' });

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    fetchDashboard(endpoint, state, { token, signal: controller.signal })
      .then(({ data, pagination, meta }) => setResult({ key, data, pagination, meta, error: null, dataKey: key }))
      .catch(err => {
        if (controller.signal.aborted && !timedOut) return; // superseded or unmounted
        const error = timedOut ? new DashboardError(errorMessage(0, 'TIMEOUT'), { code: 'TIMEOUT' }) : err;
        setResult(prev => ({ ...prev, key, error }));
      })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
    // `state` is fully represented by `url` (inside `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  // Data from another session is never shown, even while the new one loads.
  const sameSession = !needsToken || result.dataKey.split('#')[1] === token;
  const settled = result.key === key;
  return {
    active,
    loading: active && !settled,
    error: active && settled ? result.error : null,
    data: active && sameSession ? result.data : null,
    pagination: active && sameSession ? result.pagination : null,
    meta: active && sameSession ? result.meta : null,
    stale: active && result.dataKey !== key,
    retry: () => setAttempt(n => n + 1)
  };
}

// A page past the end (rows removed since the link was made, or a stale
// URL): move to the last page, or page 1 when there are none. Runs only on
// a current answer, and the new page is always valid, so it cannot loop.
export function usePageClamp(resource, page, setPage) {
  const totalPages = resource.pagination?.totalPages;
  const current = Boolean(resource.data) && !resource.stale && !resource.loading;
  const target = current && totalPages !== undefined ? clampPage(page, totalPages) : page;
  useEffect(() => {
    if (target !== page) setPage(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, page]);
}
