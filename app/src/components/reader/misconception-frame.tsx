"use client";

import type { ReactNode } from "react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { Depth, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSceneReturn } from "./scene-shell";

/** The interface's own name for the level an early door's stop belongs to (`MapStop.fromDepth`); none for any other door. */
const earlyLevelName = (ui: Ui, from?: Depth) => from === undefined ? undefined : ui.levels.find((level) => level.depth === from)?.name;

/** What a screen reader says for a misconception door after its title: the badge, and for an early door also the level its stop belongs to. */
export function misconceptionLabel(ui: Ui, from?: Depth): string[] {
  const level = earlyLevelName(ui, from);
  return level ? [ui.misconception.badge, level] : [ui.misconception.badge];
}

/** `from` is set on an early door only: the badge then also names the level the stop belongs to. */
export function MisconceptionBadge({ ui, from }: { ui: Ui; from?: Depth }) {
  const level = earlyLevelName(ui, from);
  return <span className="misconception-badge" dir="rtl"><Icon icon={InformationCircleIcon} size={16} />{ui.misconception.badge}{level ? ` \u00b7 ${level}` : ""}</span>;
}

export function MisconceptionFrame({ ui, stationKey, onBack, children }: { ui: Ui; stationKey: string; onBack: () => void; children: ReactNode }) {
  const returnToStation = useSceneReturn();
  return <div className="misconception-frame" dir="rtl">
    <p className="misconception-intro">{ui.misconception.intro}</p>
    {children}
    <Button variant="secondary" onClick={() => { returnToStation?.(stationKey); onBack(); }}>{ui.misconception.back}</Button>
  </div>;
}
