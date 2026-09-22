import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './SearchableDropdown.css';

// Free text remains valid; callers decide whether a value must match an option.
export default function SearchableDropdown({ value, onChange, options, label, placeholder, describedBy }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = options.filter(option => option.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()));
  const choose = option => {
    onChange(option);
    setOpen(false);
    setActive(-1);
  };
  const move = next => {
    setActive(next);
    requestAnimationFrame(() => document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: 'nearest' }));
  };
  return (
    <div className="searchable-dropdown" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
    }}>
      <input role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-options`}
        aria-autocomplete="list" aria-describedby={describedBy}
        aria-activedescendant={open && active >= 0 && active < matches.length ? `${id}-${active}` : undefined}
        autoComplete="off" placeholder={placeholder} value={value}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onClick={() => setOpen(true)}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            if (matches.length) move(event.key === 'ArrowDown' ? (active + 1) % matches.length : (active <= 0 ? matches.length - 1 : active - 1));
          } else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
            event.preventDefault(); choose(matches[active]);
          } else if (event.key === 'Escape') {
            event.preventDefault(); setOpen(false); setActive(-1);
          } else if (event.key === 'Tab') { setOpen(false); setActive(-1); }
        }} />
      <ChevronDown size={16} className="searchable-dropdown-chevron" aria-hidden="true" />
      <div id={`${id}-options`} role="listbox" aria-label={label} className="searchable-dropdown-options" hidden={!open}>
        {matches.map((option, index) => (
          <div key={option} id={`${id}-${index}`} role="option" aria-selected={value === option}
            className={`searchable-dropdown-option${active === index ? ' is-active' : ''}`}
            onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>
            {option}
          </div>
        ))}
        {!matches.length && <div className="searchable-dropdown-empty" role="presentation">ไม่มีรายการแนะนำที่ตรงกับคำค้น</div>}
      </div>
    </div>
  );
}
