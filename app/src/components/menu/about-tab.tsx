"use client";

import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function AboutTab({ ui, onAct }: { ui: Ui; onAct: (act: () => void) => void }) {
  return <div className="menu-about">
    <Button variant="quiet" onClick={() => onAct(() => { window.location.assign("/"); })}>{ui.landing.back_link}</Button>
    <p>{ui.disclosure.ai}</p>
    <p>{ui.disclosure.scripture}</p>
    <p>{ui.disclosure.limits}</p>
    <p className="menu-about-privacy">{ui.privacy_line}</p>
  </div>;
}
