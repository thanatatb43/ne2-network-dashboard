import { ArrowRight } from 'lucide-react';
import './NavCards.css';

// Navigation cards as real links: keyboard reachable, middle-click/Ctrl-click
// opens a new tab, and a plain click stays in the SPA via onNavigate.
export default function NavCards({ items, label }) {
  return (
    <ul className="nav-cards" aria-label={label}>
      {items.map(({ key, href, icon, tone = 'purple', title, subtitle, desc, action, onNavigate }) => (
        <li key={key}>
          <a
            className={`nav-card nav-card-${tone}`}
            href={href}
            onClick={(e) => {
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onNavigate(); }
            }}
          >
            <span className="nav-card-head">
              <span className="nav-card-icon" aria-hidden="true">{icon}</span>
              <span>
                <span className="nav-card-title">{title}</span>
                {subtitle && <span className="nav-card-subtitle">{subtitle}</span>}
              </span>
            </span>
            <span className="nav-card-desc">{desc}</span>
            <span className="nav-card-action">{action} <ArrowRight size={16} aria-hidden="true" /></span>
          </a>
        </li>
      ))}
    </ul>
  );
}
