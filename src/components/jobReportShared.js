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
