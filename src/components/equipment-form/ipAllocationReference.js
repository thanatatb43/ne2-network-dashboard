// Allocation PLAN by group (last-octet ranges per subnet kind). It is a
// reference, not an inventory: it cannot tell whether an address is free.
// Some ranges overlap and some `plannedCount` values don't match their range
// width -- they are shown as recorded until the plan owner confirms them.
export const IP_RANGE_GROUPS = [
  { group: 'Wireless LAN (AP)', primary: '1-10', sub172: '1-20', sub10: '1-20', plannedCount: 50 },
  { group: 'Voice Gateway', primary: '11-20', sub172: '21-30', sub10: '21-30', plannedCount: 30 },
  { group: 'UC', primary: null, sub172: '31-50', sub10: '31-50', plannedCount: 40 },
  { group: 'VDO Conference', primary: null, sub172: null, sub10: '81-90', plannedCount: 10 },
  { group: 'CCTV', primary: null, sub172: null, sub10: '91-120', plannedCount: 30 },
  { group: 'DHCP', primary: '100-200', sub172: null, sub10: null, plannedCount: 100 },
  { group: 'ระบบ Queue', primary: '221', sub172: '221', sub10: null, plannedCount: 2 },
  { group: 'อื่นๆ', primary: '222-240', sub172: null, sub10: '151-200', plannedCount: 50 },
  { group: 'Network', primary: null, sub172: null, sub10: '201-254', plannedCount: 54 },
  { group: 'Gateway (/24)', primary: '241', sub172: '241', sub10: '241', plannedCount: 3 },
  { group: 'ผสน', primary: null, sub172: '100-120', sub10: null, plannedCount: 20 },
  { group: 'ผบร', primary: null, sub172: '121-140', sub10: null, plannedCount: 20 },
  { group: 'ผบส', primary: null, sub172: '141-160', sub10: null, plannedCount: 20 },
  { group: 'ผปบ', primary: null, sub172: '161-180', sub10: null, plannedCount: 20 },
  { group: 'ผกส', primary: null, sub172: '181-200', sub10: null, plannedCount: 20 },
  { group: 'ผมต', primary: null, sub172: '201-220', sub10: null, plannedCount: 20 },
  { group: 'ผคพ (แยกจากวงสำนักงาน)', primary: null, sub172: null, sub10: null, plannedCount: null },
  { group: 'printer', primary: '20-50', sub172: null, sub10: '121-150', plannedCount: 50 },
  { group: 'ผู้บริหาร + บุคลากรอื่นๆ', primary: '51-80', sub172: '51-80', sub10: null, plannedCount: 60 },
  { group: 'กฟส (ผปร)', primary: null, sub172: '81-110', sub10: null, plannedCount: 30 },
  { group: 'กฟส (ผบค)', primary: null, sub172: '111-140', sub10: null, plannedCount: 30 },
  { group: 'กฟส (ผบง)', primary: null, sub172: '141-170', sub10: null, plannedCount: 30 }
];

export const SUBNET_KINDS = [
  { key: 'main', rangeKey: 'primary', label: 'วงหลัก' },
  { key: 'secondary_172', rangeKey: 'sub172', label: '172.x (สำรอง)' },
  { key: 'secondary_10', rangeKey: 'sub10', label: '10.221.x' }
];

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');

// Confirmed spellings only; anything else must match a group name exactly.
const ALIASES = { printer: 'printer', 'wireless lan': 'wireless lan (ap)', ap: 'wireless lan (ap)' };

// Exact (normalized) match on equipment type and department. Loose substring
// matching used to suggest unrelated groups for short inputs like "ผ" or "P".
export const findIpGroups = ({ equipmentType, department }) => {
  const wanted = [equipmentType, department].map(normalize).filter(Boolean).map(v => ALIASES[v] || v);
  if (!wanted.length) return [];
  return IP_RANGE_GROUPS.filter(g => wanted.includes(normalize(g.group)));
};

const OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
export const usableBase = (value) => {
  const text = String(value ?? '').trim();
  const parts = text.split('.');
  return parts.length === 4 && parts.every(p => OCTET.test(p)) ? text : null;
};

// Site subnet values are host addresses (the gateway, e.g. x.x.x.241) with no
// prefix length, so the range is built on the first three octets and always
// labeled as assuming a /24.
export const rangeText = (baseIp, range) => {
  if (!range) return null;
  const base = usableBase(baseIp);
  const prefix = base ? `${base.split('.').slice(0, 3).join('.')}.` : '.';
  if (!range.includes('-')) return `${prefix}${range}`;
  const [start, end] = range.split('-');
  return `${prefix}${start} – ${prefix}${end}`;
};

export const siteSubnets = (network) => {
  if (!network || typeof network !== 'object') return [];
  const list = SUBNET_KINDS.map(k => ({ ...k, value: usableBase(network[k.key]) })).filter(k => k.value);
  const dhcp = String(network.dhcp_range ?? '').trim();
  if (dhcp && dhcp !== '-') list.push({ key: 'dhcp_range', label: 'DHCP Range', value: dhcp, isText: true });
  return list;
};
