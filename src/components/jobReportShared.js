// Small helpers shared between JobReport.jsx (list) and JobReportDetails.jsx
// (detail) -- kept in their own module (not exported from JobReport.jsx)
// so Fast Refresh keeps working for both component files.
export const siteLabel = (s) => `${s.pea_name}${s.pea_province ? ` (${s.pea_province})` : ''}`;

// Job status uses its own tone mapping -- separate from equipment status's
// (up/warning/down/borrowed/unknown) even though both render through the
// same shared .list-status component (DESIGN_STANDARDS.md + the plan's
// section 6.2: "สถานะงานและสถานะอุปกรณ์ใช้ badge คนละ mapping").
export const jobStatusTone = (status) => {
  if (status === 'เสร็จงาน') return 'up';
  if (status === 'ระหว่างดำเนินการ') return 'warning';
  if (status === 'ยกเลิก') return 'down';
  return 'unknown'; // เปิดงาน and anything unrecognized
};

export const buildDocUrl = (path) => (path ? `${import.meta.env.VITE_API_BASE_URL}${path}` : null);
export const isImagePath = (path) => /\.(jpe?g|png|webp|gif)$/i.test(path || '');
export const formatDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

// Equipment status uses its OWN tone mapping -- deliberately separate from
// jobStatusTone even though both render through the shared .list-status
// component (see the plan's section 6.2 on not conflating the two).
export const equipmentStatusTone = (status) => {
  if (status === 'ใช้งาน') return 'up';
  if (['รอปรับปรุง', 'รอจำหน่าย', 'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน', 'รอส่งคืน'].includes(status)) return 'warning';
  if (['เลิกใช้งาน', 'จำหน่าย'].includes(status)) return 'down';
  if (status === 'ถูกยืม') return 'borrowed';
  return 'unknown';
};

export const jobPriorityTone = (priority) => (priority === 'เร่งด่วน' ? 'down' : 'unknown');

// Budget posting dates arrive as "dd.mm.yyyy" text; sort on the real date.
export const postingTime = (value) => {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(value ?? '').trim());
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export const amountOf = (t) => {
  const n = Number.parseFloat(t?.value_co_curr);
  return Number.isFinite(n) ? n : null;
};
export const formatBaht = (n) => (n === null ? '—' : `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
