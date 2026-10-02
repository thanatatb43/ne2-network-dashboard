// A4 sheets of equipment QR stickers (2 x 3 per page), shared by the stock
// page and equipment search. Use openPrintShell() synchronously in the click
// handler (so pop-up blockers allow it), then fillPrintWindow() with
// [{ id, name }]. Printing waits for every QR image to load.
const API = import.meta.env.VITE_API_BASE_URL;
export const QR_PER_PAGE = 6;

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const openPrintShell = () => {
  const w = window.open('', '_blank');
  if (w) w.document.write('<!DOCTYPE html><meta charset="utf-8"><title>กำลังเตรียม QR Code</title><p style="font-family:sans-serif;padding:2rem">กำลังเตรียม QR Code...</p>');
  return w;
};

export const fillPrintWindow = (w, items) => {
  const pages = [];
  for (let i = 0; i < items.length; i += QR_PER_PAGE) pages.push(items.slice(i, i + QR_PER_PAGE));
  const pagesHtml = pages.map(page => `<div class="page">${page.map(item => `
    <div class="qr-cell"><img src="${escapeHtml(`${API}/api/office-equipment/${item.id}/qrcode`)}" alt="QR ${escapeHtml(item.id)}" />
    <div class="caption">ID: ${escapeHtml(item.id)}</div>${item.name ? `<div class="caption name">${escapeHtml(item.name)}</div>` : ''}</div>`).join('')}</div>`).join('');
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>พิมพ์ QR Code อุปกรณ์</title><style>
  @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; }
  .page { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); gap: 8mm; width: 100%; height: 273mm; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .qr-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed #999; border-radius: 4mm; padding: 6mm; }
  .qr-cell img { width: 60mm; height: 60mm; object-fit: contain; }
  .caption { margin-top: 3mm; font-size: 11pt; color: #333; text-align: center; } .caption.name { font-size: 10pt; word-break: break-word; }
  </style></head><body>${pagesHtml}<script>
  var imgs = Array.prototype.slice.call(document.images), left = imgs.length;
  function done() { left -= 1; if (left <= 0) setTimeout(function () { window.print(); }, 200); }
  if (!left) window.print(); imgs.forEach(function (img) { if (img.complete) done(); else { img.onload = done; img.onerror = done; } });
  </script></body></html>`);
  w.document.close();
};
