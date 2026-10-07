import { useId, useState } from 'react';
import { textProblem } from '../officeDrawingDocument.js';

// Inspector inputs keep their own text while typing and commit once (blur,
// Enter, or a pick for selects) -- one undo step per edit, never per key.
function useDraft(value) {
  const [draft, setDraft] = useState({ base: value, text: value });
  if (draft.base !== value) setDraft({ base: value, text: value });
  return [draft.text, (text) => setDraft({ base: value, text })];
}

export function TextField({ label, value, onCommit, multiline = false, maxLength, disabled, placeholder, nullable = true, rows = 3 }) {
  const id = useId();
  const shown = value ?? '';
  const [text, setText] = useDraft(shown);
  const problem = textProblem(text) || (maxLength && [...text].length > maxLength ? `ยาวเกิน ${maxLength} ตัวอักษร` : '');
  const commit = () => {
    if (text === shown) return;
    onCommit(nullable && !text.trim() ? null : text);
  };
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={`od-field${problem ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Tag id={id} value={text} rows={multiline ? rows : undefined} disabled={disabled} placeholder={placeholder}
        aria-invalid={problem ? 'true' : undefined} aria-describedby={problem ? `${id}-err` : undefined}
        onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); } if (e.key === 'Escape') { setText(shown); e.currentTarget.blur(); } }} />
      {problem && <p id={`${id}-err`} className="od-field-error">{problem}</p>}
    </div>
  );
}

export function NumberField({ label, value, onCommit, min, max, step = 0.1, disabled, unit, allowNull = false }) {
  const id = useId();
  const shown = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useDraft(shown);
  const n = Number(text);
  const invalid = text === '' ? !allowNull : !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max);
  const commit = () => {
    if (text === shown || invalid) { if (invalid) setText(shown); return; }
    onCommit(text === '' ? null : Math.round(n * 10) / 10);
  };
  return (
    <div className={`od-field od-field-num${invalid ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}{unit && <span className="od-unit"> ({unit})</span>}</label>
      <input id={id} type="number" inputMode="decimal" value={text} min={min} max={max} step={step} disabled={disabled}
        onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setText(shown); e.currentTarget.blur(); } }} />
    </div>
  );
}

export function SelectField({ label, value, options, onCommit, disabled }) {
  const id = useId();
  return (
    <div className="od-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value ?? ''} disabled={disabled} onChange={e => onCommit(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// #RGB / #RRGGBB / #RRGGBBAA in the document; the colour input only does #RRGGBB.
const toInput = (hex) => {
  if (!hex) return '#000000';
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${hex.slice(1).split('').map(c => c + c).join('')}`;
  return hex.slice(0, 7);
};

export function ColorField({ label, value, fallback, onCommit, disabled }) {
  const id = useId();
  // The picker fires on every movement: show it live, commit once on close.
  const [pick, setPick] = useDraft(toInput(value || fallback));
  const commit = () => { if (pick.toUpperCase() !== toInput(value || fallback).toUpperCase()) onCommit(pick.toUpperCase()); };
  return (
    <div className="od-field od-field-color">
      <label htmlFor={id}>{label}</label>
      <div className="od-color-row">
        <input id={id} type="color" value={pick} disabled={disabled} onChange={e => setPick(e.target.value)} onBlur={commit} />
        <span className="od-color-text">{value ? value.toUpperCase() : 'ค่าเริ่มต้น'}</span>
        {value && !disabled && <button type="button" className="od-link" onClick={() => onCommit(null)}>ใช้ค่าเริ่มต้น</button>}
      </div>
    </div>
  );
}
