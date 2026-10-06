"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import type { BottomSheetProps } from "@/components/reader/bottom-sheet";

export type WideTab = "passage" | "source" | "term" | "ask" | "weave";
type Host = "detail" | "ask" | "popover";
type Registration = { close: (refocus?: boolean) => void; tab?: WideTab; anchor?: HTMLElement | null };
const subscribe = (notify: () => void) => {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia("(min-width: 1024px)").matches;
type SurfaceState = {
  wide: boolean; tab: WideTab; panelOpen: boolean; setPanelOpen: (value: boolean) => void;
  selectTab: (tab: WideTab) => void; hosts: Partial<Record<Host, HTMLElement>>;
  setHost: (kind: Host, node: HTMLElement | null) => void;
  register: (kind: Host, close: (refocus?: boolean) => void, tab?: WideTab, anchor?: HTMLElement | null) => () => void;
  closeDetail: () => boolean; closePopover: (refocus?: boolean) => boolean; detailTab?: WideTab; hasPopover: boolean;
  popoverAnchor?: HTMLElement | null;
  suggestions: string[]; setSuggestions: (questions: string[]) => void;
};
const WideSurfaceContext = createContext<SurfaceState | null>(null);
export const useWideSurface = () => useContext(WideSurfaceContext);

export function WideSurfaceProvider({ children }: { children: ReactNode }) {
  const wide = useSyncExternalStore(subscribe, snapshot, () => false);
  const [tab, setTab] = useState<WideTab>("passage");
  const tabRef = useRef(tab); tabRef.current = tab;
  const backTab = useRef<WideTab>("passage");
  const [panelOpen, setPanelOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hosts, setHosts] = useState<Partial<Record<Host, HTMLElement>>>({});
  const [registered, setRegistered] = useState<Partial<Record<Host, Registration>>>({});
  const registerRef = useRef(registered); registerRef.current = registered;
  const selectTab = useCallback((next: WideTab) => { setTab(next); setPanelOpen(true); }, []);
  const setHost = useCallback((kind: Host, node: HTMLElement | null) => setHosts((previous) => previous[kind] === node ? previous : { ...previous, [kind]: node ?? undefined }), []);
  const register = useCallback((kind: Host, close: (refocus?: boolean) => void, next?: WideTab, anchor?: HTMLElement | null) => {
    const registration = { close, tab: next, anchor };
    if (kind === "detail") {
      if (tabRef.current !== "source" && tabRef.current !== "term") backTab.current = tabRef.current;
      if (next) selectTab(next);
    } else if (kind === "ask") selectTab("ask");
    setRegistered((previous) => ({ ...previous, [kind]: registration }));
    return () => setRegistered((previous) => previous[kind] === registration ? { ...previous, [kind]: undefined } : previous);
  }, [selectTab]);
  const closeDetail = useCallback(() => {
    const detail = registerRef.current.detail;
    if (!detail) return false;
    detail.close(); selectTab(backTab.current); return true;
  }, [selectTab]);
  const closePopover = useCallback((refocus = true) => {
    const popover = registerRef.current.popover;
    if (!popover) return false;
    popover.close(refocus); return true;
  }, []);
  const value = useMemo(() => ({ wide, tab, panelOpen, setPanelOpen, selectTab, hosts, setHost, register, closeDetail, closePopover, detailTab: registered.detail?.tab, hasPopover: Boolean(registered.popover), popoverAnchor: registered.popover?.anchor, suggestions, setSuggestions }), [wide, tab, panelOpen, selectTab, hosts, setHost, register, closeDetail, closePopover, registered, suggestions]);
  return <WideSurfaceContext.Provider value={value}>{children}</WideSurfaceContext.Provider>;
}

/** Presentation adapter: source, Ask, voice, key and unit logic stay in their existing components. */
export function WideSheet({ title, ui, onClose, children, term, variant, titleAfter }: BottomSheetProps) {
  const surface = useWideSurface()!;
  const kind: Host = variant === "ask" ? "ask" : term || title === ui.panel.title ? "detail" : "popover";
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [origin] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dismiss = useCallback((refocus = true) => {
    if (kind === "ask") surface.selectTab("passage");
    else closeRef.current();
    if (refocus) requestAnimationFrame(() => { if (origin?.isConnected) origin.focus({ preventScroll: true }); });
  }, [kind, surface.selectTab, origin]);
  useEffect(() => {
    const unregister = surface.register(kind, dismiss, kind === "detail" ? term ? "term" : "source" : undefined, origin);
    const run = kind === "detail" ? origin?.closest<HTMLElement>("[data-run], .ask-source .claim-text") : null;
    run?.setAttribute("data-active-source", "true");
    return () => { unregister(); run?.removeAttribute("data-active-source"); };
  }, [surface.register, kind, term, dismiss, origin]);
  const target = surface.hosts[kind];
  useEffect(() => { if (target && kind !== "ask") closeButton.current?.focus({ preventScroll: true }); }, [target, kind]);
  if (!target) return null;
  return createPortal(<section className={`wide-sheet${variant === "ask" ? " wide-ask-sheet" : ""}`} aria-label={title} role={kind === "popover" ? "dialog" : undefined}>
    <header className="wide-sheet-header"><h2 className={term ? "huda-sheet-title huda-term-title" : "huda-sheet-title"}>{title}</h2>{titleAfter}
      {kind !== "ask" ? <button ref={closeButton} className="wide-icon-button" type="button" onClick={() => kind === "detail" ? surface.closeDetail() : dismiss()} aria-label={ui.panel.close}><Icon icon={Cancel01Icon} /></button> : null}
    </header>
    <div className="wide-sheet-body">{typeof children === "function" ? children(dismiss) : children}</div>
  </section>, target);
}
