import { isBox, isVisible, renderOrder, titleBlockRect, KNOWN_TYPES, objectName } from './officeDrawingDocument.js';
import { boxCorners } from './officeDrawingGeometry.js';
import { dimensionGeometry } from './officeDrawingMeasure.js';

export function layoutWarnings(doc) {
  const { width, height } = doc.page;
  const tb = doc.title_block ? titleBlockRect(doc.page) : null;
  const out = [], under = [];
  for (const o of renderOrder(doc)) {
    if (!KNOWN_TYPES.includes(o.type) || !isVisible(doc, o)) continue;
    const pts = o.type === 'dimension'
      ? dimensionGeometry(o).ext.flat()
      : isBox(o) ? boxCorners(o) : o.points;
    if (pts.some(p => p.x < 0 || p.y < 0 || p.x > width || p.y > height)) out.push(objectName(o));
    else if (tb && pts.some(p => p.x > tb.x && p.x < tb.x + tb.width && p.y > tb.y && p.y < tb.y + tb.height)) under.push(objectName(o));
  }
  return { out, under };
}

export function printImageStatus(doc, sources) {
  const ids = new Set(doc.objects.filter(o => o.type === 'image' && isVisible(doc, o)).map(o => o.asset_id));
  let loading = 0, failed = 0;
  for (const id of ids) {
    const source = sources?.get(id);
    if (source?.state === 'missing' || source?.state === 'error') failed += 1;
    else if (!source?.url || !['ready', 'public'].includes(source.state)) loading += 1;
  }
  return { loading, failed };
}

// SVG images have no decode method. Check every URL (including the logo)
// with a separate image, rejecting failures rather than printing empty boxes.
export function preloadPrintImages(urls, { signal, createImage = () => new Image(), timeoutMs = 15000 } = {}) {
  return Promise.all([...new Set(urls)].map(src => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Print cancelled')); return; }
    const img = createImage();
    const finish = (error) => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('Print cancelled'));
    const timer = setTimeout(() => finish(new Error('Image load timed out')), timeoutMs);
    img.onload = () => finish();
    img.onerror = () => finish(new Error('Image load failed'));
    signal?.addEventListener('abort', abort, { once: true });
    img.src = src;
  })));
}
