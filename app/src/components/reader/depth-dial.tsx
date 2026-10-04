"use client";

import type { CSSProperties } from "react";
import type { Depth, Ui } from "@/lib/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type DepthDialProps = { depth: Depth; levels: Ui["levels"]; label: string; onChange: (depth: Depth) => void };
export function DepthDial({ depth, levels, label, onChange }: DepthDialProps) {
  return <RadioGroup className="depth-dial" aria-label={label} orientation="horizontal" dir="rtl" value={String(depth)} onValueChange={(value) => onChange(Number(value) as Depth)} style={{ "--depth": depth } as CSSProperties}>
    <span className="depth-thumb" aria-hidden="true" />
    {levels.map((level) => <RadioGroupItem key={level.depth} className="depth-notch" value={String(level.depth)} showIndicator={false}
      // The arrow keys must choose, not only move focus. Radix chooses through a flag that a quick keyup can clear before focus lands,
      // so selection follows keyboard focus here. A mouse press is not :focus-visible and still chooses through the click.
      onFocus={(event) => { if (level.depth !== depth && event.currentTarget.matches(":focus-visible")) onChange(level.depth); }}>{level.name}</RadioGroupItem>)}
  </RadioGroup>;
}
