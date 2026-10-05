"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

/** `threaded`: the map above ends on the ayah thread, so a gold stretch joins the thread to the entry. A level that ends on a shelf of sections has no thread to join. */
export type ClosingEntryProps = { ui: Ui; hidden?: boolean; threaded?: boolean; onOpen: () => void };
/** The small door at the end of the map to the surah's closing screen. It is not a stop: it has no number, no pip and no sources. */
export function ClosingEntry({ ui, hidden = false, threaded = false, onOpen }: ClosingEntryProps) {
  return <div className={`closing-entry${threaded ? " is-threaded" : ""}`} hidden={hidden}>
    <span className="closing-entry-node" aria-hidden="true" />
    <button type="button" className="closing-entry-button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(); }}>{ui.summary.open}<Icon icon={ArrowLeft01Icon} /></button>
  </div>;
}
