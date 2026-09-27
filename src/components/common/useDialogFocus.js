import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, newest last. Only the top one reacts to Tab/Escape, so a
// confirm opened over another dialog doesn't also close the one beneath.
const stack = [];

// Accessible modal behaviour: focus moved in and trapped, Escape calls
// onEscape, focus returns to the opener on close.
export default function useDialogFocus(open, ref, onEscape) {
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; });
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    stack.push(token);
    const opener = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    (first || node)?.focus();
    const onKey = (event) => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape') { event.stopPropagation(); escapeRef.current?.(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)];
      if (!items.length) { event.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (!node.contains(document.activeElement)) { event.preventDefault(); head.focus(); }
      else if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, [open, ref]);
}
