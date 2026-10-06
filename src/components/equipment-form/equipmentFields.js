export const EQUIPMENT_TYPE_OPTIONS = [
  'PC', 'Notebook', 'Mobile', 'Printer', 'Wireless LAN (AP)', 'Voice Gateway', 'UC', 'VDO Conference',
  'CCTV', 'DHCP', 'ระบบ Queue', 'อื่นๆ', 'Network', 'Gateway (/24)'
];

export const DEPARTMENT_OPTIONS = [
  'ผสน', 'ผบร', 'ผบส', 'ผปบ', 'ผกส', 'ผมต', 'ผคพ (แยกจากวงสำนักงาน)',
  'ผู้บริหาร + บุคลากรอื่นๆ', 'กฟส (ผปร)', 'กฟส (ผบค)', 'กฟส (ผบง)'
];

export const STATUS_OPTIONS = [
  'ใช้งาน', 'รอปรับปรุง', 'เลิกใช้งาน', 'รอจำหน่าย', 'จำหน่าย',
  'รอจ่ายคืน', 'รอแจกคืน', 'รอรับโอน', 'รอส่งคืน', 'active', 'จัดเก็บ', 'อื่นๆ'
];

// Keeps a stored status that isn't in the fixed list selectable, so editing
// another field never silently rewrites it.
export const statusOptionsFor = (current) => {
  const value = typeof current === 'string' ? current.trim() : '';
  return value && !STATUS_OPTIONS.includes(value) ? [value, ...STATUS_OPTIONS] : STATUS_OPTIONS;
};

export const SECTIONS = [
  {
    id: 'general', title: 'ข้อมูลทั่วไป', fields: [
      { name: 'name', label: 'ชื่ออุปกรณ์', type: 'text', required: true },
      { name: 'equipment_type', label: 'ประเภทอุปกรณ์', type: 'combo', options: EQUIPMENT_TYPE_OPTIONS },
      { name: 'department', label: 'แผนก', type: 'combo', options: DEPARTMENT_OPTIONS },
      { name: 'status', label: 'สถานะ', type: 'combo', options: STATUS_OPTIONS, required: true }
    ]
  },
  {
    id: 'network', title: 'เครือข่าย', fields: [
      { name: 'ip_address', label: 'IP Address', type: 'text', mono: true, placeholder: 'เช่น 172.21.5.10', inputMode: 'decimal' },
      { name: 'mac_address', label: 'MAC Address', type: 'text', mono: true, mac: true, placeholder: 'AA:BB:CC:DD:EE:FF', hint: 'ตัวพิมพ์ใหญ่ คั่นด้วย : (ระบบแปลงให้เมื่อออกจากช่อง)' },
      { name: 'wifi_mac_address', label: 'Wi-Fi MAC Address', type: 'text', mono: true, mac: true, placeholder: 'AA:BB:CC:DD:EE:FF', hint: 'MAC ของการ์ด Wi-Fi (ถ้ามี) รูปแบบเดียวกับ MAC Address' }
    ]
  },
  {
    id: 'asset', title: 'ทรัพย์สินและผู้ถือครอง', fields: [
      { name: 'equipment_code', label: 'รหัสอุปกรณ์', type: 'text' },
      { name: 'serial_number', label: 'Serial Number', type: 'text' },
      { name: 'asset_number', label: 'รหัสทรัพย์สิน', type: 'text' },
      { name: 'asset_owner', label: 'ผู้ถือครอง', type: 'text' },
      { name: 'asset_owner_emp_id', label: 'รหัสพนักงานผู้ถือครอง', type: 'text' }
    ]
  },
  {
    id: 'place', title: 'สถานที่และรูปภาพ', fields: [
      { name: 'storage_location', label: 'สถานที่ติดตั้งหรือจัดเก็บ', type: 'text' }
    ]
  },
  {
    id: 'vendor', title: 'ผู้ขายและสัญญา', fields: [
      { name: 'vendor', label: 'ผู้ขาย (Vendor)', type: 'text' },
      { name: 'contract_no', label: 'เลขที่สัญญา', type: 'text' },
      { name: 'contract_start_date', label: 'วันเริ่มสัญญา', type: 'date' },
      { name: 'contract_expiry_date', label: 'วันหมดอายุสัญญา', type: 'date' }
    ]
  },
  {
    id: 'notes', title: 'หมายเหตุ', fields: [
      { name: 'notes', label: 'หมายเหตุ', type: 'textarea', placeholder: 'รายละเอียด ที่ตั้ง หรือข้อมูลอื่นๆ' }
    ]
  }
];

// The only keys ever sent in POST/PUT. Read-only data from the API
// (id, photos, storage_photo, network_ip, loans, nested site/user objects)
// must never be echoed back.
export const WRITABLE_FIELDS = [...SECTIONS.flatMap(s => s.fields.map(f => f.name)), 'pea_site_id'];

export const MAC_FIELDS = SECTIONS.flatMap(s => s.fields.filter(f => f.mac).map(f => f.name));

// Fields the backend clears to null when sent the exact string "-". Required
// fields and the site id are not on the list (the API ignores "-" there).
export const DASH_CLEARABLE = new Set([
  'equipment_code', 'ip_address', 'mac_address', 'wifi_mac_address', 'department', 'equipment_type', 'notes',
  'contract_no', 'vendor', 'serial_number', 'asset_number', 'asset_owner', 'asset_owner_emp_id',
  'storage_location', 'contract_start_date', 'contract_expiry_date'
]);

export const FIELD_LABELS = Object.fromEntries(SECTIONS.flatMap(s => s.fields.map(f => [f.name, f.label])).concat([['pea_site_id', 'สำนักงาน']]));

const toText = (value) => (value === null || value === undefined ? '' : String(value));

// Draft = strings only, one key per writable field.
export const draftFromRecord = (record = {}) => Object.fromEntries(WRITABLE_FIELDS.map(name => [name, toText(record[name])]));

export const emptyDraft = ({ siteId = '', source } = {}) => ({
  ...draftFromRecord({}),
  pea_site_id: toText(siteId),
  // Office pages have always created equipment as "ใช้งาน"; other entry
  // points (stock, plain form) have always left status blank.
  status: source === 'office' ? 'ใช้งาน' : ''
});

export const isDirty = (draft, baseline) => WRITABLE_FIELDS.some(name => toText(draft[name]) !== toText(baseline[name]));

export const EDIT_ROLES = ['super_admin', 'computer_admin', 'network_admin', 'operator'];
export const canEditEquipment = (user) => EDIT_ROLES.includes(user?.role);
export const canDeleteEquipment = (user) => user?.role === 'super_admin';
