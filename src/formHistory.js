// Remembers what the user typed into text fields (not dropdowns) and offers
// it back as suggestions the next time that field is focused -- like browser
// autofill, but per page + field label and per signed-in user, kept in
// localStorage. One app-wide listener; forms don't need to opt in.
//
// Never remembered: passwords, username/one-time-code fields, dropdowns and
// comboboxes, fields that already have their own suggestion list, read-only
// or disabled fields, and anything inside [data-no-form-history].

const STORAGE_PREFIX = 'ne2.formHistory.v1:';
export const MAX_VALUES = 8;
const MAX_FIELDS = 300;
const MAX_LENGTH = 200;
const TEXT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url']);
const SKIP_AUTOCOMPLETE = new Set(['username', 'current-password', 'new-password', 'one-time-code', 'cc-number', 'cc-csc']);
const LIST_ID = 'ne2-form-history';

let owner = 'guest';
export const setFormHistoryOwner = (id) => { owner = id == null || id === '' ? 'guest' : String(id); };
const storageKey = () => `${STORAGE_PREFIX}${owner}`;

// Same field on another record (/equipment/12/edit vs /equipment/40/edit)
// shares its history; different pages keep theirs apart.
export function routeKey(pathname) {
  return String(pathname || '/')
    .replace(/\/(\d+|new)(?=\/|$)/g, '/:id')
    .replace(/\/+$/, '') || '/';
}

export function labelKey({ label, ariaLabel, name, placeholder }) {
  const raw = label || ariaLabel || name || placeholder || '';
  return raw.replace(/\(จำเป็น\)/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

// Newest first, no duplicates (case-sensitive), capped.
export function addValue(list, value) {
  const v = String(value ?? '').trim();
  if (!v || v.length > MAX_LENGTH) return list || [];
  return [v, ...(list || []).filter((x) => x !== v)].slice(0, MAX_VALUES);
}

const readAll = () => {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey()));
    return data && typeof data === 'object' && data.fields ? data : { fields: {}, order: [] };
  } catch {
    return { fields: {}, order: [] };
  }
};
const writeAll = (data) => {
  try { localStorage.setItem(storageKey(), JSON.stringify(data)); } catch { /* full or blocked: skip */ }
};

export function clearFormHistory() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* nothing to clear */ }
}

function eligible(el) {
  if (!(el instanceof HTMLInputElement)) return false;
  if (!TEXT_TYPES.has(el.type) || el.readOnly || el.disabled) return false;
  if (el.closest('[data-no-form-history]')) return false;
  if (SKIP_AUTOCOMPLETE.has((el.getAttribute('autocomplete') || '').toLowerCase())) return false;
  if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete')) return false;
  if (el.hasAttribute('list') && el.getAttribute('list') !== LIST_ID) return false;
  return true;
}

function fieldKeyOf(el) {
  const label = labelKey({
    label: el.labels?.[0]?.textContent,
    ariaLabel: el.getAttribute('aria-label'),
    name: el.name,
    placeholder: el.placeholder
  });
  return label ? `${routeKey(window.location.pathname)}|${label}` : null;
}

function remember(el) {
  const key = fieldKeyOf(el);
  if (!key || !el.value.trim()) return;
  const data = readAll();
  data.fields[key] = addValue(data.fields[key], el.value);
  data.order = [key, ...data.order.filter((k) => k !== key)];
  for (const old of data.order.slice(MAX_FIELDS)) delete data.fields[old];
  data.order = data.order.slice(0, MAX_FIELDS);
  writeAll(data);
}

function suggest(el) {
  const key = fieldKeyOf(el);
  const values = key ? (readAll().fields[key] || []).filter((v) => v !== el.value) : [];
  if (!values.length) {
    if (el.getAttribute('list') === LIST_ID) el.removeAttribute('list');
    return;
  }
  let list = document.getElementById(LIST_ID);
  if (!list) {
    list = document.createElement('datalist');
    list.id = LIST_ID;
    document.body.appendChild(list);
  }
  list.replaceChildren(...values.map((v) => { const o = document.createElement('option'); o.value = v; return o; }));
  el.setAttribute('list', LIST_ID);
}

export function installFormHistory() {
  const onChange = (e) => { if (eligible(e.target)) remember(e.target); };
  const onFocus = (e) => { if (eligible(e.target)) suggest(e.target); };
  document.addEventListener('change', onChange, true);
  document.addEventListener('focusin', onFocus, true);
  return () => {
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('focusin', onFocus, true);
  };
}
