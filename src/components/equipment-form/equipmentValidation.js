import { WRITABLE_FIELDS } from './equipmentFields.js';

export const isValidIpAddress = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(part => Number(part) <= 255);
export const isValidMacAddress = (mac) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);

// Visible normalization only (applied on blur, so the user sees the result):
// lowercase and "-" separated MACs become the uppercase ":" form the backend
// accepts. Anything that doesn't then look like a MAC is left untouched.
export const normalizeMac = (value) => {
  const text = String(value ?? '').trim();
  const candidate = text.toUpperCase().replace(/-/g, ':');
  return isValidMacAddress(candidate) ? candidate : text;
};

const isRealDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validateDraft = (draft, { requireSite = true } = {}) => {
  const errors = {};
  const get = (name) => String(draft[name] ?? '').trim();
  if (!get('name')) errors.name = 'กรุณากรอกชื่ออุปกรณ์';
  if (requireSite && !get('pea_site_id')) errors.pea_site_id = 'กรุณาเลือกสำนักงาน';
  const ip = get('ip_address');
  if (ip && !isValidIpAddress(ip)) errors.ip_address = 'IP Address ไม่ถูกต้อง ใช้รูปแบบ เช่น 172.21.5.10';
  const mac = get('mac_address');
  if (mac && !isValidMacAddress(mac)) errors.mac_address = 'MAC Address ต้องเป็นรูปแบบ AA:BB:CC:DD:EE:FF (ตัวพิมพ์ใหญ่)';
  const start = get('contract_start_date');
  const end = get('contract_expiry_date');
  if (start && !isRealDate(start)) errors.contract_start_date = 'วันที่ไม่ถูกต้อง';
  if (end && !isRealDate(end)) errors.contract_expiry_date = 'วันที่ไม่ถูกต้อง';
  if (start && end && isRealDate(start) && isRealDate(end) && start > end) {
    errors.contract_expiry_date = 'วันหมดอายุสัญญาต้องไม่ก่อนวันเริ่มสัญญา';
  }
  return errors;
};

// Form-urlencoded body with exactly the writable fields, trimmed, keeping
// the existing contract: an empty field is sent as '' (never dropped).
export const serializeDraft = (draft, { siteId } = {}) => {
  const params = new URLSearchParams();
  WRITABLE_FIELDS.forEach(name => {
    const value = name === 'pea_site_id' && siteId != null ? siteId : draft[name];
    params.append(name, String(value ?? '').trim());
  });
  return params;
};
