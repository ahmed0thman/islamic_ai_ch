"use client";

import { MapsIcon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type ViewToggleProps = { view: "map" | "text"; ui: Ui; onChange: (view: "map" | "text") => void };
export function ViewToggle({ view, ui, onChange }: ViewToggleProps) {
  return <div className="view-toggle"><Button variant="quiet" aria-pressed={view === "map"} onClick={() => onChange("map")}><Icon icon={MapsIcon} />{ui.reader.map_view}</Button><Button variant="quiet" aria-pressed={view === "text"} onClick={() => onChange("text")}><Icon icon={BookOpen01Icon} />{ui.reader.read_continuous}</Button></div>;
}
