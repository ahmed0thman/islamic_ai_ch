"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { SourceRecord, Ui } from "@/lib/types";
import { SourceBadge } from "@/components/ui/source-badge";
import { useWideSurface } from "./wide-surface";

export function useMarkerPreview(records: SourceRecord[], ui: Ui) {
  const surface = useWideSurface();
  const id = useId();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const show = (element: HTMLElement) => {
    if (!surface?.wide || !surface.hosts.detail) return;
    const rect = element.getBoundingClientRect();
    setPosition({ x: Math.min(window.innerWidth - 312, Math.max(12, rect.left + rect.width / 2 - 150)), y: Math.min(window.innerHeight - 236, Math.max(64, rect.bottom + 8)) });
  };
  const hide = () => setPosition(null);
  useEffect(() => {
    if (!position) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, true);
  }, [position]);
  const card = position && surface?.wide ? createPortal(<div id={id} role="tooltip" className="wide-marker-preview" style={{ left: position.x, top: position.y }}>
    {records.slice(0, 3).map((record) => <div key={record.id}><b>{record.evidence[0]?.source_title ?? ui.panel.source}</b><p>{record.badge ? <SourceBadge kind={record.badge} ui={ui} /> : !record.state ? ui.panel.no_badge : null}{record.state ? <SourceBadge state={record.state} ui={ui} /> : null}</p></div>)}
  </div>, document.body) : null;
  return { show, hide, card, describedBy: position ? id : undefined };
}
