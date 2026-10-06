"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import type { Ui } from "@/lib/types";
import { wideGuideCardPosition, GUIDE_OPEN_EVENT, guideSteps, readGuideSeen, shouldGuideOpen, writeGuideSeen, type GuideStep, type GuideSurface } from "@/lib/guide";
import { useWideSurface } from "@/components/wide/wide-surface";

export type GuidePlace = "top" | "bottom" | "center" | "wide";
export type GuideSpot = { top: number; left: number; width: number; height: number; place: GuidePlace; card: { left: number; top: number } | null };
export type GuideView = {
  open: boolean;
  surface: GuideSurface;
  step: GuideStep | null;
  index: number;
  total: number;
  last: boolean;
  spot: GuideSpot | null;
  titleId: string;
  bodyId: string;
  cardRef: RefObject<HTMLElement | null>;
  primaryRef: RefObject<HTMLButtonElement | null>;
  goNext: () => void;
  goPrevious: () => void;
  skip: () => void;
};

const GROW = 6;

/** The first selector whose element has a layout box. On the wide layout a hidden element never resolves; when showing a
    step (`scroll`), an off-screen candidate is scrolled in first and falls through to the next selector only if it stays out. */
function resolveTarget(step: GuideStep, surface: GuideSurface, scroll: boolean): HTMLElement | null {
  for (const selector of step.targets) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || !element.getClientRects().length) continue;
    if (surface !== "wide") return element;
    if (getComputedStyle(element).visibility === "hidden") continue;
    if (scroll && !intersectsViewport(element)) {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      if (!intersectsViewport(element)) continue;
    }
    return element;
  }
  return null;
}

function intersectsViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

/** The guide's client state and effects: open/close, step, seen flag, target lookup and keyboard. */
export function useGuide({ ui, active, onPrepare }: { ui: Ui; active: boolean; onPrepare: () => void }): GuideView {
  const wide = useWideSurface()?.wide ?? false;
  const surface: GuideSurface = wide ? "wide" : "phone";
  const allSteps = useMemo(() => guideSteps(ui.guide, surface), [ui, surface]);
  const allStepsRef = useRef(allSteps); allStepsRef.current = allSteps;
  const surfaceRef = useRef(surface); surfaceRef.current = surface;
  const [open, setOpen] = useState(false);
  const [resolvable, setResolvable] = useState<GuideStep[]>([]);
  const resolvableRef = useRef(resolvable); resolvableRef.current = resolvable;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index); indexRef.current = index;
  const [spot, setSpot] = useState<GuideSpot | null>(null);
  const spotRef = useRef<GuideSpot | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);
  const scrollYRef = useRef(0);
  const focusRef = useRef<HTMLElement | null>(null);
  const openSurfaceRef = useRef<GuideSurface>(surface);
  const suppressAutoRef = useRef(false);
  const [pending, setPending] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const prepareRef = useRef(onPrepare); prepareRef.current = onPrepare;
  const titleId = useId();
  const bodyId = useId();

  const closeGuide = useCallback((seen: boolean) => {
    cancelAnimationFrame(rafRef.current);
    setOpen(false);
    spotRef.current = null;
    targetRef.current = null;
    setSpot(null);
    window.scrollTo({ top: scrollYRef.current, behavior: "auto" });
    const origin = focusRef.current;
    if (origin && origin.isConnected) origin.focus({ preventScroll: true });
    if (seen) writeGuideSeen(openSurfaceRef.current);
  }, []);

  const openGuide = useCallback(() => {
    const current = surfaceRef.current;
    const resolved = allStepsRef.current.filter((item) => item.targets.length === 0 || resolveTarget(item, current, false) !== null);
    if (!resolved.length) return;
    scrollYRef.current = window.scrollY;
    focusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openSurfaceRef.current = current;
    resolvableRef.current = resolved;
    indexRef.current = 0;
    spotRef.current = null;
    setResolvable(resolved);
    setIndex(0);
    setSpot(null);
    setOpen(true);
  }, []);

  // `?guide=1` opens the tour once and leaves the URL clean. The reopen event asks for the same explicit open.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("guide") !== "1") return;
    url.searchParams.delete("guide");
    window.history.replaceState(window.history.state, "", url);
    setPending(true);
  }, []);
  useEffect(() => {
    const onEvent = () => { prepareRef.current(); setPending(true); };
    window.addEventListener(GUIDE_OPEN_EVENT, onEvent);
    return () => window.removeEventListener(GUIDE_OPEN_EVENT, onEvent);
  }, []);

  // One decision for both surfaces: an explicit request always opens; otherwise the first visit to this surface
  // opens once, unless a breakpoint resize already closed a guide in this page view. The two-frame delay lets the
  // phone/wide surface settle, so the tour opens on the surface the reader is actually on.
  useEffect(() => {
    if (!active || open) return;
    if (!shouldGuideOpen({ seen: readGuideSeen(surface), requested: pending, surface })) return;
    if (!pending && suppressAutoRef.current) return;
    if (!pending && document.documentElement.hasAttribute("data-huda-sheet-open")) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { setPending(false); openGuide(); }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [active, open, surface, pending, openGuide]);

  // A surface change while open closes without claiming the tour was seen, and the other surface must not
  // auto-open for the rest of this page view.
  useEffect(() => {
    if (open && openSurfaceRef.current !== surface) { suppressAutoRef.current = true; closeGuide(false); }
  }, [surface, open, closeGuide]);

  // The step that is shown: scroll it into view, remember its target, focus the primary action.
  useEffect(() => {
    if (!open) return;
    const step = resolvableRef.current[index];
    targetRef.current = step ? resolveTarget(step, openSurfaceRef.current, true) : null;
    const target = targetRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      const inside = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
      if (!inside) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
      }
    }
    primaryRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  // One loop follows the target while the guide is open; state changes only when the rect really moved.
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const target = targetRef.current;
      if (!target) {
        if (spotRef.current !== null) { spotRef.current = null; setSpot(null); }
        return;
      }
      const rect = target.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const left = Math.max(0, rect.left - GROW);
      const top = Math.max(0, rect.top - GROW);
      const right = Math.min(width, rect.right + GROW);
      const bottom = Math.min(height, rect.bottom + GROW);
      const center = (Math.max(0, rect.top) + Math.min(height, rect.bottom)) / 2;
      const box = cardRef.current?.getBoundingClientRect();
      const card = openSurfaceRef.current === "wide" ? wideGuideCardPosition({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, { width: box?.width ?? 0, height: box?.height ?? 0 }, { width, height }) : null;
      const place: GuidePlace = openSurfaceRef.current === "wide" ? (card ? "wide" : "center") : center < height / 2 ? "bottom" : "top";
      const next: GuideSpot = { top, left, width: right - left, height: bottom - top, place, card };
      const previous = spotRef.current;
      if (!previous || previous.top !== next.top || previous.left !== next.left || previous.width !== next.width || previous.height !== next.height || previous.place !== next.place || previous.card?.left !== next.card?.left || previous.card?.top !== next.card?.top) {
        spotRef.current = next;
        setSpot(next);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

  const skip = useCallback(() => closeGuide(true), [closeGuide]);
  const goNext = useCallback(() => {
    const last = resolvableRef.current.length - 1;
    if (indexRef.current >= last) { closeGuide(true); return; }
    setIndex((value) => Math.min(value + 1, last));
  }, [closeGuide]);
  const goPrevious = useCallback(() => setIndex((value) => Math.max(value - 1, 0)), []);
  const cycleFocus = useCallback((backwards: boolean) => {
    const card = cardRef.current;
    if (!card) return;
    const buttons = Array.from(card.querySelectorAll<HTMLElement>("button")).filter((element) => element.getClientRects().length > 0);
    if (!buttons.length) return;
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? 0 : (at + (backwards ? buttons.length - 1 : 1)) % buttons.length;
    buttons[next].focus({ preventScroll: true });
  }, []);

  // Capture every key while open so the reader's own shortcuts stay silent under the guide.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") closeGuide(true);
      else if (event.key === "ArrowLeft") goNext();
      else if (event.key === "ArrowRight") goPrevious();
      else if (event.key === "Tab") { event.preventDefault(); cycleFocus(event.shiftKey); }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, closeGuide, goNext, goPrevious, cycleFocus]);

  useEffect(() => {
    if (!open) return;
    const onPop = () => closeGuide(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, closeGuide]);

  const step = resolvable[index] ?? resolvable[0] ?? null;
  return {
    open,
    surface,
    step,
    index,
    total: resolvable.length,
    last: resolvable.length > 0 && index >= resolvable.length - 1,
    spot,
    titleId,
    bodyId,
    cardRef,
    primaryRef,
    goNext,
    goPrevious,
    skip,
  };
}
