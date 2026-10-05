"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * The full-screen scene every reading screen above the map shares: a stop, and the closing screen.
 * It stays mounted when one swaps for the other, so the sheet does not slide in a second time.
 * Its body marks the heading with `data-scene-heading`; the shell focuses it on open and returns focus to the opener on close.
 */
export function SceneShell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const [origin] = useState(() => ({ opener: typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null, y: typeof window !== "undefined" ? window.scrollY : 0 }));
  return <Dialog open onOpenChange={(open) => { if (!open) onBack(); }}>
    <DialogContent className="huda-stop-scene" overlayClassName="scene-scrim" showCloseButton={false} aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); document.querySelector<HTMLElement>(".huda-stop-scene [data-scene-heading]")?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); window.scrollTo({ top: origin.y, behavior: "instant" }); origin.opener?.focus({ preventScroll: true }); }}>
      {children}
    </DialogContent>
  </Dialog>;
}
