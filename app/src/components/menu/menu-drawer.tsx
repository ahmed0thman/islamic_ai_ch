"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Tabs } from "radix-ui";
import { Cancel01Icon, InformationCircleIcon, Quran01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { jumpToAyah } from "@/lib/reader-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AboutTab } from "./about-tab";
import { MushafTab } from "./mushaf-tab";

type Target = { surah: number; ayah?: number };
export type MenuDrawerProps = { ui: Ui; current: number; onClose: () => void };
/** A dialog that enters from the start edge. Same history and focus handling as the bottom sheets: the entry it pushes is gone before the next page opens. */
export function MenuDrawer({ ui, current, onClose }: MenuDrawerProps) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const historyOrigin = useRef<{ state: unknown; pushed: boolean }>({ state: null, pushed: false });
  const mounted = useRef(false);
  const pending = useRef<Target | null>(null);
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
    return { opener, ancestors, y: typeof window !== "undefined" ? window.scrollY : 0 };
  });

  useEffect(() => {
    mounted.current = true;
    document.documentElement.setAttribute("data-huda-sheet-open", "");
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
      // Preserve a single entry during the development effect rehearsal.
      queueMicrotask(() => {
        if (!mounted.current && window.history.state?.hudaSheet === id) window.history.replaceState(historyOrigin.current.state, "", window.location.href);
      });
    };
  }, [id]);

  function requestClose() {
    if (window.history.state?.hudaSheet === id) window.history.back();
    else setOpen(false);
  }
  // Choose, close, then act: the menu's own history entry is gone before the page changes.
  function choose(target: Target) { pending.current = target; requestClose(); }

  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) requestClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="menu-overlay" />
      <Dialog.Content className="menu-drawer" aria-describedby={undefined}
        onOpenAutoFocus={(event) => { event.preventDefault(); closeButton.current?.focus({ preventScroll: true }); }}
        onEscapeKeyDown={(event) => {
          // Escape in a search field that has text clears the text; the field handles the key itself.
          const field = document.activeElement;
          if (field instanceof HTMLInputElement && field.type === "search" && field.value) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          for (const { element, top, inline } of origin.ancestors) { element.scrollTop = top; element.scrollLeft = inline; }
          window.scrollTo({ top: origin.y, behavior: "instant" });
          origin.opener?.focus({ preventScroll: true });
          onCloseRef.current();
          const target = pending.current;
          pending.current = null;
          if (!target) return;
          if (target.surah === current) {
            const { surah, ayah } = target;
            if (ayah) requestAnimationFrame(() => jumpToAyah(`${surah}:${ayah}`));
          } else router.push(target.ayah ? `/s/${target.surah}/?ayah=${target.ayah}` : `/s/${target.surah}/`);
        }}>
        <header className="menu-head">
          <Dialog.Title className="menu-title">{ui.menu.title}</Dialog.Title>
          <Button ref={closeButton} variant="round" size="icon" onClick={requestClose} aria-label={ui.panel.close}><Icon icon={Cancel01Icon} /></Button>
        </header>
        <Tabs.Root className="menu-tabs" defaultValue="mushaf" dir="rtl">
          <Tabs.List className="menu-tablist" aria-label={ui.menu.title}>
            <Tabs.Trigger className="menu-tab" value="mushaf"><Icon icon={Quran01Icon} />{ui.menu.tab_mushaf}</Tabs.Trigger>
            <Tabs.Trigger className="menu-tab" value="about"><Icon icon={InformationCircleIcon} />{ui.menu.tab_about}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="menu-panel" value="mushaf"><MushafTab ui={ui} current={current} onChoose={choose} /></Tabs.Content>
          <Tabs.Content className="menu-panel" value="about"><AboutTab ui={ui} /></Tabs.Content>
        </Tabs.Root>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
