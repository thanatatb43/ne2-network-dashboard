import { Children, cloneElement, useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Keep the original cells (including date drill-down links) available in
// the expanded view; only their preview is clipped in the compact row.
export default function ExpandableRow({ children, labels, label }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const cells = Children.toArray(children);
  return (
    <>
      <tr className={`oed-compact-row${open ? ' is-expanded' : ''}`}>
        <td className="oed-expand-cell">
          <button type="button" className="oed-expand-button" aria-expanded={open} aria-controls={id}
            aria-label={`${open ? 'ย่อ' : 'ขยาย'}รายละเอียด ${label}`} onClick={() => setOpen(value => !value)}>
            {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </button>
        </td>
        {cells.map(cell => cloneElement(cell, {}, <div className="oed-cell-preview">{cell.props.children}</div>))}
      </tr>
      <tr className="oed-expanded-row" hidden={!open}>
        <td colSpan={cells.length + 1}>
          <div id={id} className="oed-row-details" role="region" aria-label={`รายละเอียด ${label}`}>
            {open && cells.map((cell, index) => <div className="oed-detail-field" key={cell.key}>
              <strong className="oed-detail-label">{labels[index]}</strong>
              <div>{cell.props.children}</div>
            </div>)}
          </div>
        </td>
      </tr>
    </>
  );
}
