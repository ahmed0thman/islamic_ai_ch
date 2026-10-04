"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export type BottomSheetProps = {
  title: string; ui: Ui; onClose: () => void; children: ReactNode | ((dismiss: () => void) => ReactNode); term?: boolean;
};
export function BottomSheet({ title, ui, onClose, children, term = false }: BottomSheetProps) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const historyOrigin = useRef<{ state: unknown; pushed: boolean }>({ state: null, pushed: false });
  const mounted = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [origin] = useState(() => {
    const opener = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ancestors: { element: HTMLElement; top: number; inline: number }[] = [];
    for (let element = opener?.parentElement; element; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        ancestors.push({ element, top: element.scrollTop, inline: element.scrollLeft });
      }
    }
    return { opener, ancestors, run: opener?.closest<HTMLElement>("[data-run]"), y: typeof window !== "undefined" ? window.scrollY : 0 };
  });

  useEffect(() => {
    mounted.current = true;
    document.documentElement.setAttribute("data-huda-sheet-open", "");
    origin.run?.setAttribute("data-active-source", "true");
    if (!historyOrigin.current.pushed) {
      historyOrigin.current = { state: window.history.state, pushed: true };
      window.history.pushState({ ...window.history.state, hudaSheet: id }, "", window.location.href);
    }
    const onBack = () => { if (window.history.state?.hudaSheet !== id) setOpen(false); };
    window.addEventListener("popstate", onBack);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", onBack);
      document.documentElement.removeAttribute("data-huda-sheet-open");
      origin.run?.removeAttribute("data-active-source");
      // Preserve a single entry during the development effect rehearsal.
      queueMicrotask(() => {
        if (!mounted.current && window.history.state?.hudaSheet === id) window.history.replaceState(historyOrigin.current.state, "", window.location.href);
      });
    };
  }, [id, origin]);

  function requestClose() {
    if (window.history.state?.hudaSheet === id) window.history.back();
    else setOpen(false);
  }
  return <Sheet open={open} onOpenChange={(value) => { if (!value) requestClose(); }}>
    <SheetContent side="bottom" showCloseButton={false} aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); closeButton.current?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        for (const { element, top, inline } of origin.ancestors) { element.scrollTop = top; element.scrollLeft = inline; }
        window.scrollTo({ top: origin.y, behavior: "instant" });
        origin.opener?.focus({ preventScroll: true });
        onCloseRef.current();
      }}>
      <div className="sheet-grabber" aria-hidden="true" />
      <header className="huda-sheet-header">
        <SheetTitle className={term ? "huda-sheet-title huda-term-title" : "huda-sheet-title"}>{title}</SheetTitle>
        <Button ref={closeButton} variant="round" size="icon" onClick={requestClose} aria-label={ui.panel.close}><Icon icon={Cancel01Icon} /></Button>
      </header>
      <div className="huda-sheet-scroll">{typeof children === "function" ? children(requestClose) : children}</div>
    </SheetContent>
  </Sheet>;
}
