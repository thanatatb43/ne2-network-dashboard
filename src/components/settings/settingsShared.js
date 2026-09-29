export const API = import.meta.env?.VITE_API_BASE_URL;

// Thai labels for the backend's role values. The descriptions only state
// what this app's screens actually gate on each role.
export const ROLES = [
  { value: 'user', label: 'ผู้ใช้ทั่วไป', desc: 'ใช้งานหน้าทั่วไป ยืม-คืนอุปกรณ์ และแจ้งปัญหา ไม่เห็นเมนูการจัดการ' },
  { value: 'manager', label: 'ผู้บริหาร', desc: 'เห็นเมนูการจัดการและการตั้งค่าระบบ แต่แก้ไขการตั้งค่าไม่ได้' },
  { value: 'operator', label: 'ผู้ปฏิบัติงาน', desc: 'จัดการงานแจ้งปัญหา เพิ่ม/แก้ไขงบประมาณ ไม่เห็นเมนูการตั้งค่าระบบ' },
  { value: 'computer_admin', label: 'ผู้ดูแลระบบคอมพิวเตอร์', desc: 'จัดการอุปกรณ์คอมพิวเตอร์และงานแจ้งปัญหา' },
  { value: 'network_admin', label: 'ผู้ดูแลระบบเครือข่าย', desc: 'จัดการอุปกรณ์เครือข่ายและงานแจ้งปัญหา' },
  { value: 'super_admin', label: 'ผู้ดูแลระบบสูงสุด', desc: 'ทำได้ทุกอย่าง รวมถึงการตั้งค่าระบบ ลบข้อมูล และจัดการสำนักงาน' }
];
export const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label || role || 'ไม่ระบุสิทธิ์';
export const roleTone = (role) => (role === 'super_admin' ? 'down' : String(role || '').includes('admin') ? 'borrowed' : 'unknown');

export const settingsPermissions = (user) => {
  const role = user?.role;
  // Editing users is for admin roles; everyone else who reaches the page
  // (the menu shows it to super_admin and manager) only reads.
  const readOnly = !['super_admin', 'network_admin', 'computer_admin'].includes(role);
  return {
    readOnly,
    canEditUsers: !readOnly,
    canManageLocations: role === 'super_admin'
  };
};

// Same rule the page always enforced: 10+ chars with upper, lower and a
// special character.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{10,}$/;
// "lat, long" pasted straight from Google Maps.
export const COORDINATES_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

// Error message for a coordinates string, or '' when it is fine. 0 is a
// valid value (never treated as empty).
export function coordinatesProblem(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (!COORDINATES_PATTERN.test(v)) return 'รูปแบบต้องเป็น "ละติจูด, ลองจิจูด" เช่น 16.246825, 102.821954';
  const [lat, lng] = v.split(',').map((x) => Number(x.trim()));
  if (lat < -90 || lat > 90) return 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90';
  if (lng < -180 || lng > 180) return 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180';
  return '';
}

// What PUT/POST /api/pea-sites should get for coordinates, compared with
// the value the form started from:
//   unchanged -> omit (undefined); cleared -> null (JSON null removes them);
//   new text -> the text. Never "" or the string "null".
export function coordinatesPayload(initial, current) {
  const before = String(initial ?? '').trim();
  const now = String(current ?? '').trim();
  if (now === before) return undefined;
  if (!now) return before ? null : undefined;
  return now;
}

export const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—';

export const failureMessage = (response, result, fallback) => {
  if (response?.status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (response?.status === 403) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
  return result?.message || result?.error || fallback;
};

export const readJson = (key, fallback) => {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
export const writeJson = (key, value) => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* optional */ }
};

export const loadUsers = async (token, signal) => {
  const response = await fetch(`${API}/api/auth/users`, { headers: { Authorization: `Bearer ${token}` }, signal });
  const data = await response.json().catch(() => null);
  const list = Array.isArray(data) ? data : data?.data;
  if (!response.ok || !Array.isArray(list)) throw new Error(failureMessage(response, data, 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ'));
  return list.filter(Boolean);
};
