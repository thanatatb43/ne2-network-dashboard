import { useEffect, useRef, useState } from 'react';
import { assetContentUrl, fetchAssetBlob } from './officeDrawingApi.js';

// Image sources for the renderer: assetId -> { url, state }.
// - With a session: authenticated fetch -> Blob URL (temporary uploads are
//   private; the same bytes then also go to print). Revoked when unused,
//   on logout/account switch and on unmount.
// - Without: the public content URL (the server serves it only while an
//   active drawing references the image).
// - Metadata state "missing" (or a failed fetch): a placeholder, the rest of
//   the drawing still opens.
export default function useImageSources(assetIds, { token = null, meta = null } = {}) {
  const ids = [...new Set(assetIds.filter(Boolean))].sort();
  const key = ids.join(',');
  const [sources, setSources] = useState(() => new Map());
  const blobs = useRef(new Map()); // `${token}|${id}` -> object URL

  useEffect(() => {
    const controller = new AbortController();
    const prefix = `${token || ''}|`;
    // Drop URLs of another session or of images no longer used.
    for (const [k, url] of blobs.current) {
      if (!k.startsWith(prefix) || !ids.includes(k.slice(prefix.length))) { URL.revokeObjectURL(url); blobs.current.delete(k); }
    }
    const next = new Map();
    const pending = [];
    for (const id of ids) {
      const m = meta?.get(id);
      if (m?.state === 'missing') { next.set(id, { state: 'missing' }); continue; }
      if (!token) { next.set(id, { state: 'public', url: assetContentUrl(id) }); continue; }
      const cached = blobs.current.get(prefix + id);
      if (cached) { next.set(id, { state: 'ready', url: cached }); continue; }
      next.set(id, { state: 'loading' });
      pending.push(id);
    }
    Promise.resolve().then(() => { if (!controller.signal.aborted) setSources(new Map(next)); });
    for (const id of pending) {
      fetchAssetBlob(id, token, controller.signal)
        .then(r => {
          if (controller.signal.aborted) return;
          if (!r.ok) { setSources(s => new Map(s).set(id, { state: 'missing' })); return; }
          const url = URL.createObjectURL(r.blob);
          blobs.current.set(prefix + id, url);
          setSources(s => new Map(s).set(id, { state: 'ready', url }));
        })
        .catch(() => { if (!controller.signal.aborted) setSources(s => new Map(s).set(id, { state: 'error' })); });
    }
    return () => controller.abort();
    // `key` stands for `ids`; meta only matters for "missing".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token, meta]);

  useEffect(() => () => {
    for (const url of blobs.current.values()) URL.revokeObjectURL(url);
    blobs.current.clear();
  }, []);

  return sources;
}
