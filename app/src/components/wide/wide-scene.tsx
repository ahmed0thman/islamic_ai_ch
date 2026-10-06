"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { SceneReturnContext } from "@/components/reader/scene-shell";
import { useWideSurface } from "./wide-surface";
import { restoreWideAyah } from "./wide-position";

export function SceneTitle({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  return useWideSurface()?.wide ? <>{children}</> : <DialogTitle asChild={asChild}>{children}</DialogTitle>;
}
export function WideScene({ children, onReturnAyah }: { children: ReactNode; onReturnAyah?: (key: string) => void }) {
  const returnKey = useRef<string | null>(null);
  const [origin] = useState(() => ({ opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, y: window.scrollY }));
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      const key = returnKey.current;
      requestAnimationFrame(() => {
        if (key) restoreWideAyah(key);
        else { window.scrollTo({ top: origin.y, behavior: "instant" }); origin.opener?.focus({ preventScroll: true }); }
      });
    };
  }, [origin]);
  return <SceneReturnContext.Provider value={(key) => { returnKey.current = key; onReturnAyah?.(key); }}><section className="wide-scene">{children}</section></SceneReturnContext.Provider>;
}
