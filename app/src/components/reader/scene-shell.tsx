"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { jumpToAyah } from "@/lib/reader-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWideSurface } from "@/components/wide/wide-surface";
import { WideScene } from "@/components/wide/wide-scene";

export const SceneReturnContext = createContext<((key: string) => void) | null>(null);
export const useSceneReturn = () => useContext(SceneReturnContext);

/**
 * The full-screen scene every reading screen above the map shares: a stop, and the closing screen.
 * It stays mounted when one swaps for the other, so the sheet does not slide in a second time.
 * Its body marks the heading with `data-scene-heading`; the shell focuses it on open and returns focus to the opener on close.
 */
export function SceneShell({ onBack, onReturnAyah, children }: { onBack: () => void; onReturnAyah?: (key: string) => void; children: ReactNode }) {
  const surface = useWideSurface();
  return surface?.wide ? <WideScene onReturnAyah={onReturnAyah}>{children}</WideScene> : <PhoneSceneShell onBack={onBack} onReturnAyah={onReturnAyah}>{children}</PhoneSceneShell>;
}
function PhoneSceneShell({ onBack, onReturnAyah, children }: { onBack: () => void; onReturnAyah?: (key: string) => void; children: ReactNode }) {
  const returnKey = useRef<string | null>(null);
  const [origin] = useState(() => ({ opener: typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null, y: typeof window !== "undefined" ? window.scrollY : 0 }));
  return <Dialog open onOpenChange={(open) => { if (!open) onBack(); }}>
    <DialogContent className="huda-stop-scene" overlayClassName="scene-scrim" showCloseButton={false} aria-describedby={undefined}
      onOpenAutoFocus={(event) => { event.preventDefault(); document.querySelector<HTMLElement>(".huda-stop-scene [data-scene-heading]")?.focus({ preventScroll: true }); }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (returnKey.current) {
          const key = returnKey.current;
          window.requestAnimationFrame(() => jumpToAyah(key));
        } else {
          window.scrollTo({ top: origin.y, behavior: "instant" }); origin.opener?.focus({ preventScroll: true });
        }
      }}>
      <SceneReturnContext.Provider value={(key) => { returnKey.current = key; onReturnAyah?.(key); }}>{children}</SceneReturnContext.Provider>
    </DialogContent>
  </Dialog>;
}
