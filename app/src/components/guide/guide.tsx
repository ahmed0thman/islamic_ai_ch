"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { useWideSurface } from "@/components/wide/wide-surface";
import { GUIDE_OPEN_EVENT, guideSteps, readGuideSeen, writeGuideSeen, type GuideStep, type GuideSurface } from "@/lib/guide";

type Place = "top" | "bottom" | "center";
type Spot = { top: number; left: number; width: number; height: number; place: Place };

/** The first selector whose element has a layout box; a hidden element never resolves. */
function targetFor(step: GuideStep, surface: GuideSurface): HTMLElement | null {
  for (const selector of step.targets) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || !element.getClientRects().length) continue;
    if (surface === "wide" && getComputedStyle(element).visibility === "hidden") continue;
    return element;
  }
  return null;
}

export function Guide({ ui, active, onPrepare }: { ui: Ui; active: boolean; onPrepare: () => void }) {
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
  const [spot, setSpot] = useState<Spot | null>(null);
  const spotRef = useRef<Spot | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);
  const scrollYRef = useRef(0);
  const focusRef = useRef<HTMLElement | null>(null);
  const openSurfaceRef = useRef<GuideSurface>(surface);
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
    if (surfaceRef.current === "wide") return;
    const current = surfaceRef.current;
    const resolved = allStepsRef.current.filter((item) => item.targets.length === 0 || targetFor(item, current) !== null);
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

  // First visit to a surah page: open at step one once the page has painted and no sheet is up.
  useEffect(() => {
    if (!active || open || surface === "wide") return;
    if (readGuideSeen(surface)) return;
    if (document.documentElement.hasAttribute("data-huda-sheet-open")) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(openGuide); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [active, open, surface, openGuide]);

  // `?guide=1` opens the tour once and leaves the URL clean.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("guide") !== "1") return;
    url.searchParams.delete("guide");
    window.history.replaceState(window.history.state, "", url);
    setPending(true);
  }, []);

  // A reopen event waits for the map: the reader returns from a stop scene first, then this fires.
  useEffect(() => {
    const onEvent = () => { prepareRef.current(); setPending(true); };
    window.addEventListener(GUIDE_OPEN_EVENT, onEvent);
    return () => window.removeEventListener(GUIDE_OPEN_EVENT, onEvent);
  }, []);
  useEffect(() => {
    if (!pending || !active) return;
    setPending(false);
    openGuide();
  }, [pending, active, openGuide]);

  // A surface change while open closes without claiming the tour was seen.
  useEffect(() => {
    if (open && openSurfaceRef.current !== surface) closeGuide(false);
  }, [surface, open, closeGuide]);

  // The step that is shown: scroll it into view, remember its target, focus the primary action.
  useEffect(() => {
    if (!open) return;
    const step = resolvableRef.current[index];
    targetRef.current = step ? targetFor(step, openSurfaceRef.current) : null;
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
      const left = Math.max(0, rect.left - 6);
      const top = Math.max(0, rect.top - 6);
      const right = Math.min(width, rect.right + 6);
      const bottom = Math.min(height, rect.bottom + 6);
      const center = (Math.max(0, rect.top) + Math.min(height, rect.bottom)) / 2;
      const place: Place = center < height / 2 ? "bottom" : "top";
      const next: Spot = { top, left, width: right - left, height: bottom - top, place };
      const previous = spotRef.current;
      if (!previous || previous.top !== next.top || previous.left !== next.left || previous.width !== next.width || previous.height !== next.height || previous.place !== next.place) {
        spotRef.current = next;
        setSpot(next);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

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

  if (!open) return null;
  const step = resolvable[index] ?? resolvable[0];
  if (!step) return null;
  const last = index >= resolvable.length - 1;
  const progress = ui.guide.progress.replace("{current}", numeral(index + 1)).replace("{total}", numeral(resolvable.length));
  const place: Place = spot ? spot.place : "center";
  return createPortal(<div className="guide" data-surface={surface} data-target={spot ? "target" : "none"}>
    <div className="guide-blocker" />
    {spot ? <div className="guide-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} /> : null}
    <section ref={cardRef} className="guide-card" data-place={place} role="dialog" aria-modal="true" aria-label={ui.guide.title} aria-labelledby={titleId} aria-describedby={bodyId}>
      <p className="guide-progress">{progress}</p>
      <div aria-live="polite"><h2 id={titleId}>{step.title}</h2><p id={bodyId}>{step.body}</p></div>
      <div className="guide-actions">
        {!last ? <Button variant="quiet" onClick={() => closeGuide(true)}>{ui.guide.skip}</Button> : null}
        {index > 0 ? <Button variant="pill" onClick={goPrevious}>{ui.guide.previous}</Button> : null}
        <Button ref={primaryRef} variant="primary" onClick={goNext}>{last ? ui.guide.done : ui.guide.next}</Button>
      </div>
    </section>
  </div>, document.body);
}
