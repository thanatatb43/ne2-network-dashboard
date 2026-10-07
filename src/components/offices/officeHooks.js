import { useEffect, useRef, useState } from 'react';
import { replaceHistory, pushHistory } from '../../navigationGuard';
import { request, urls } from './officeDrawingApi.js';

// List state (search/type/sort/page) kept in the query string so Back,
// Forward, refresh and shared links restore it. `parse` turns
// URLSearchParams into a normalized object; defaults are left out of the URL.
export function useUrlQuery(parse, defaults) {
  const [state, setState] = useState(() => parse(new URLSearchParams(window.location.search)));
  const ref = useRef(state);
  useEffect(() => { ref.current = state; });
  useEffect(() => {
    const path = window.location.pathname;
    const onPop = () => { if (window.location.pathname === path) setState(parse(new URLSearchParams(window.location.search))); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (changes, { push = false } = {}) => {
    const next = parse(new URLSearchParams(Object.entries({ ...ref.current, ...changes }).map(([k, v]) => [k, String(v ?? '')])));
    ref.current = next;
    setState(next);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (String(v) !== String(defaults[k] ?? '') && String(v) !== '') q.set(k, String(v));
    const url = window.location.pathname + (q.toString() ? `?${q}` : '');
    if (window.location.pathname + window.location.search !== url) (push ? pushHistory : replaceHistory)({}, url);
  };
  return [state, update];
}

// One GET keyed by url + token: a late answer for an older query or an
// older session never replaces the current one. Public endpoints get the
// token only when there is a session.
export function useDrawingResource(url, { token = null, enabled = true, nonce = 0 } = {}) {
  const [attempt, setAttempt] = useState(0);
  const key = `${url}#${token || ''}#${attempt}.${nonce}`;
  const [result, setResult] = useState({ key: '', dataKey: '', value: null });
  useEffect(() => {
    if (!enabled || !url) return undefined;
    const controller = new AbortController();
    request(url, { token, signal: controller.signal })
      .then(r => setResult(prev => (r.ok ? { key, dataKey: key, value: r } : { ...prev, key, error: r })))
      .catch(() => { /* aborted: superseded */ });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  const settled = result.key === key;
  const sameSession = result.dataKey.split('#')[1] === (token || '');
  return {
    loading: enabled && !settled,
    error: enabled && settled && result.dataKey !== key ? result.error : null,
    data: enabled && sameSession ? result.value?.data ?? null : null,
    pagination: enabled && sameSession ? result.value?.pagination ?? null : null,
    body: enabled && sameSession ? result.value?.body ?? null : null,
    stale: result.dataKey !== key,
    retry: () => setAttempt(n => n + 1)
  };
}

// Debounced text input bound to a committed value (search boxes).
export function useDebouncedText(committed, onCommit, delay = 400) {
  const [draft, setDraft] = useState({ base: committed, text: committed });
  if (draft.base !== committed) setDraft({ base: committed, text: committed });
  useEffect(() => {
    if (draft.text === committed) return undefined;
    const t = setTimeout(() => onCommit(draft.text), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.text, committed]);
  return [draft.text, (text) => setDraft({ base: committed, text })];
}

// Office name for an id. The selectors endpoint has no id filter, so pages
// are read until the site turns up (cached for the session).
const siteCache = new Map();
export function useSiteInfo(siteId) {
  const id = String(siteId);
  const [result, setResult] = useState({ id: null, status: 'loading', site: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (siteCache.has(id)) return undefined;
    const controller = new AbortController();
    (async () => {
      for (let page = 1; page <= 20; page += 1) {
        const r = await request(urls.selectors({ page, limit: 1000 }), { signal: controller.signal });
        if (!r.ok) { setResult({ id, status: 'error', site: null, error: r }); return; }
        for (const s of r.data?.sites || []) siteCache.set(String(s.value), s);
        if (siteCache.has(id)) { setResult({ id, status: 'ready', site: siteCache.get(id) }); return; }
        if (!r.pagination || page >= r.pagination.totalPages) break;
      }
      setResult({ id, status: 'notfound', site: null });
    })().catch(() => { /* aborted */ });
    return () => controller.abort();
  }, [id, attempt]);
  const retry = () => setAttempt(n => n + 1);
  if (siteCache.has(id)) return { status: 'ready', site: siteCache.get(id), retry };
  if (result.id === id) return { ...result, retry };
  return { status: 'loading', site: null, retry };
}

export const allCachedSites = () => [...siteCache.values()];
