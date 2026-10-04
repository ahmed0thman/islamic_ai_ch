"use client";

import { MapsIcon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type ViewToggleProps = { view: "map" | "text"; ui: Ui; onChange: (view: "map" | "text") => void };
/** One calm link to the other way of reading, as in the adopted model, instead of two tabs that spend a row. */
export function ViewToggle({ view, ui, onChange }: ViewToggleProps) {
  const next = view === "map" ? "text" : "map";
  return <div className="view-toggle"><Button variant="quiet" onClick={() => onChange(next)}><Icon icon={next === "map" ? MapsIcon : BookOpen01Icon} />{next === "map" ? ui.reader.map_view : ui.reader.read_continuous}</Button></div>;
}
