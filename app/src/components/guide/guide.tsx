"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { useGuide } from "./use-guide";

export function Guide({ ui, active, onPrepare }: { ui: Ui; active: boolean; onPrepare: () => void }): ReactNode {
  const guide = useGuide({ ui, active, onPrepare });
  if (!guide.open || !guide.step) return null;
  const progress = ui.guide.progress.replace("{current}", numeral(guide.index + 1)).replace("{total}", numeral(guide.total));
  const place = guide.spot ? guide.spot.place : "center";
  const style = guide.spot?.card ? { left: guide.spot.card.left, top: guide.spot.card.top } : undefined;
  return createPortal(<div className="guide" data-surface={guide.surface} data-target={guide.spot ? "target" : "none"}>
    <div className="guide-blocker" />
    {guide.spot ? <div className="guide-spot" style={{ top: guide.spot.top, left: guide.spot.left, width: guide.spot.width, height: guide.spot.height }} /> : null}
    <section ref={guide.cardRef} className="guide-card" data-place={place} style={style} role="dialog" aria-modal="true" aria-label={ui.guide.title} aria-labelledby={guide.titleId} aria-describedby={guide.bodyId}>
      <p className="guide-progress">{progress}</p>
      <div aria-live="polite"><h2 id={guide.titleId}>{guide.step.title}</h2><p id={guide.bodyId}>{guide.step.body}</p></div>
      <div className="guide-actions">
        {!guide.last ? <Button variant="quiet" onClick={guide.skip}>{ui.guide.skip}</Button> : null}
        {guide.index > 0 ? <Button variant="pill" onClick={guide.goPrevious}>{ui.guide.previous}</Button> : null}
        <Button ref={guide.primaryRef} variant="primary" onClick={guide.goNext}>{guide.last ? ui.guide.done : ui.guide.next}</Button>
      </div>
    </section>
  </div>, document.body);
}
