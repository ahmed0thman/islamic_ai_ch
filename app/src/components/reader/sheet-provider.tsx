"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Direction } from "radix-ui";
import type { SourceRecord, Surah, Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { LegendSheet } from "./legend-sheet";
import { ReadingUnitSheet } from "./reading-unit-sheet";
import { SourceSheet } from "./source-sheet";
import { useWideSurface, WideSurfaceProvider } from "@/components/wide/wide-surface";
import { SettingsProvider } from "@/components/settings/settings";

export type SourceOptions = { term?: string; phrase?: string };
type Selection = { kind: "source"; records: SourceRecord[]; term?: string; phrase?: string; revision: number } | { kind: "legend" } | { kind: "unit"; surah: Surah; scope: Scope; onChoose: (scope: Scope) => void } | null;
type SheetActions = { openUnit: (surah: Surah, scope: Scope, onChoose: (scope: Scope) => void) => void; legendOpen: boolean; /** The id of the record the open source sheet is about (its firmest), or null. */ openRecord: string | null; openSource: (records: SourceRecord[], options?: SourceOptions) => void; openLegend: () => void; closeSheet: () => void };
const SheetContext = createContext<SheetActions | null>(null);
/** The words the reader pressed a mark after: the text of the marked run it sits in, without the marks and ayah references. */
function pressedPhrase(): string | undefined {
  const opener = document.activeElement;
  const run = opener instanceof HTMLElement ? opener.closest<HTMLElement>("[data-run]") : null;
  if (!run) return undefined;
  const copy = run.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".source-marker, .inline-ayah-reference").forEach((node) => node.remove());
  return copy.textContent?.replace(/\s+/g, " ").trim() || undefined;
}
export function SheetProvider({ ui, children }: { ui: Ui; children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  const revision = useRef(0);
  const openSource = useCallback((records: SourceRecord[], options?: SourceOptions) => {
    if (records.length) setSelection({ kind: "source", records, term: options?.term, phrase: options?.term ? undefined : options?.phrase ?? pressedPhrase(), revision: ++revision.current });
  }, []);
  const openUnit = useCallback((surah: Surah, scope: Scope, onChoose: (scope: Scope) => void) => setSelection({ kind: "unit", surah, scope, onChoose }), []);
  const openLegend = useCallback(() => setSelection({ kind: "legend" }), []);
  const closeSheet = useCallback(() => setSelection(null), []);
  const openRecord = selection?.kind === "source" ? selection.records[0]?.id ?? null : null;
  const actions = useMemo(() => ({ legendOpen: selection?.kind === "legend", openRecord, openSource, openUnit, openLegend, closeSheet }), [selection, openRecord, openSource, openUnit, openLegend, closeSheet]);
  return <Direction.Provider dir="rtl"><WideSurfaceProvider><SettingsProvider ui={ui}><SheetContext.Provider value={actions}>
    {children}
    {selection?.kind === "legend" ? <LegendSheet ui={ui} onClose={closeSheet} /> : null}
    {selection?.kind === "unit" ? <ReadingUnitSheet surah={selection.surah} scope={selection.scope} ui={ui} onChoose={selection.onChoose} onClose={closeSheet} /> : null}
    {selection?.kind === "source" ? <SelectedSource selection={selection} ui={ui} onClose={closeSheet} /> : null}
  </SheetContext.Provider></SettingsProvider></WideSurfaceProvider></Direction.Provider>;
}
function SelectedSource({ selection, ui, onClose }: { selection: Extract<Selection, { kind: "source" }>; ui: Ui; onClose: () => void }) {
  const surface = useWideSurface();
  return <SourceSheet key={surface?.wide ? selection.revision : undefined} records={selection.records} term={selection.term} phrase={selection.phrase} ui={ui} onClose={onClose} />;
}
export function useSheets() {
  const value = useContext(SheetContext);
  if (!value) throw new Error("Reader sheets require SheetProvider");
  return value;
}
