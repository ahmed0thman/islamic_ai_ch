"use client";

import type { ReactNode } from "react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSceneReturn } from "./scene-shell";

export function MisconceptionBadge({ ui }: { ui: Ui }) {
  return <span className="misconception-badge" dir="rtl"><Icon icon={InformationCircleIcon} size={16} />{ui.misconception.badge}</span>;
}

export function MisconceptionFrame({ ui, stationKey, onBack, children }: { ui: Ui; stationKey: string; onBack: () => void; children: ReactNode }) {
  const returnToStation = useSceneReturn();
  return <div className="misconception-frame" dir="rtl">
    <p className="misconception-intro">{ui.misconception.intro}</p>
    {children}
    <Button variant="secondary" onClick={() => { returnToStation?.(stationKey); onBack(); }}>{ui.misconception.back}</Button>
  </div>;
}
