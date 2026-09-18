import { useEffect } from "react";

// Focus trap shared by the size modal and the order drawer (same behavior as
// the booking drawer: Tab cycles inside, Escape closes, focus returns).
export function useDialog(open, onClose, panelRef, returnRef) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      panelRef.current?.querySelector("button,a[href],input,select")?.focus();
    }, 80);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = panelRef.current?.querySelectorAll("input,select,textarea,button,a[href]");
        if (!els?.length) return;
        const list = Array.from(els).filter((el) => !el.disabled);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      returnRef?.current?.focus?.();
    };
  }, [open, onClose, panelRef, returnRef]);
}

