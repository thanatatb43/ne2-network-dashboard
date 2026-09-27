import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible modal shell: labelled dialog, focus moved in and trapped,
// Escape closes (unless busy), focus returns to the opener on close.
export default function useDialogFocus(open, ref, onEscape) {
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; });
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); escapeRef.current?.(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, [open, ref]);
}
