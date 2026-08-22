// src/components/ui/BottomSheet.jsx
// Accessible bottom-sheet dialog (MOBILE_ROADMAP #2). The shared primitive the
// roadmap called for: build it once, reuse for filters, and any future mobile
// modal. Implements the WCAG dialog contract —
//   role="dialog" + aria-modal, labelled title, focus trap, initial focus,
//   focus restoration on close, Escape to close, background made `inert`,
//   body-scroll lock, and env(safe-area-inset-bottom) padding.
// Portals to <body> so the rest of the app (#root) can be marked inert without
// disabling the sheet itself.
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function BottomSheet({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);
  const titleId = useRef(`sheet-${Math.random().toString(36).slice(2, 9)}`);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const root = document.getElementById("root");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;

    // Initial focus: the first focusable in the sheet, else the panel.
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = [...(panel?.querySelectorAll(FOCUSABLE) || [])].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!items.length) { e.preventDefault(); panel?.focus(); return; }
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (root) root.inert = false;
      // Restore focus to whatever opened the sheet.
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] md:hidden">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_.2s_ease]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-se-charcoal border-t border-se-concrete rounded-t-2xl outline-none animate-[slideUp_.28s_cubic-bezier(.2,.8,.2,1)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-se-concrete">
          <h2 id={titleId.current} className="font-display text-[15px] tracking-[0.06em] text-se-bone">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={20} className="text-se-bone/70" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-se-concrete">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
