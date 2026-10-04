"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Direction } from "radix-ui";
import type { SourceRecord, Surah, Ui } from "@/lib/types";
import type { Scope } from "@/lib/scope";
import { LegendSheet } from "./legend-sheet";
import { ReadingUnitSheet } from "./reading-unit-sheet";
import { SourceSheet } from "./source-sheet";

export type SourceOptions = { term?: string };
type Selection = { kind: "source"; records: SourceRecord[]; term?: string } | { kind: "legend" } | { kind: "unit"; surah: Surah; scope: Scope; onChoose: (scope: Scope) => void } | null;
type SheetActions = { openUnit: (surah: Surah, scope: Scope, onChoose: (scope: Scope) => void) => void; legendOpen: boolean; openSource: (records: SourceRecord[], options?: SourceOptions) => void; openLegend: () => void; closeSheet: () => void };
const SheetContext = createContext<SheetActions | null>(null);
export function SheetProvider({ ui, children }: { ui: Ui; children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  const openSource = useCallback((records: SourceRecord[], options?: SourceOptions) => {
    if (records.length) setSelection({ kind: "source", records, term: options?.term });
  }, []);
  const openUnit = useCallback((surah: Surah, scope: Scope, onChoose: (scope: Scope) => void) => setSelection({ kind: "unit", surah, scope, onChoose }), []);
  const openLegend = useCallback(() => setSelection({ kind: "legend" }), []);
  const closeSheet = useCallback(() => setSelection(null), []);
  const actions = useMemo(() => ({ legendOpen: selection?.kind === "legend", openSource, openUnit, openLegend, closeSheet }), [selection, openSource, openUnit, openLegend, closeSheet]);
  return <Direction.Provider dir="rtl"><SheetContext.Provider value={actions}>
    {children}
    {selection?.kind === "legend" ? <LegendSheet ui={ui} onClose={closeSheet} /> : null}
    {selection?.kind === "unit" ? <ReadingUnitSheet surah={selection.surah} scope={selection.scope} ui={ui} onChoose={selection.onChoose} onClose={closeSheet} /> : null}
    {selection?.kind === "source" ? <SourceSheet records={selection.records} term={selection.term} ui={ui} onClose={closeSheet} /> : null}
  </SheetContext.Provider></Direction.Provider>;
}
export function useSheets() {
  const value = useContext(SheetContext);
  if (!value) throw new Error("Reader sheets require SheetProvider");
  return value;
}
