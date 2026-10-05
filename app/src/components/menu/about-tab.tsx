"use client";

import type { Ui } from "@/lib/types";

export function AboutTab({ ui }: { ui: Ui }) {
  return <div className="menu-about">
    <p>{ui.disclosure.ai}</p>
    <p>{ui.disclosure.scripture}</p>
    <p>{ui.disclosure.limits}</p>
    <p className="menu-about-privacy">{ui.privacy_line}</p>
  </div>;
}
