"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Ayah, SourceRecord, Surah, Ui } from "@/lib/types";
import type { SourceOptions } from "./sheet-provider";

export type ReadingProps = { surahNo?: number; relations?: SourceRecord[]; ayahs: Map<string, Ayah>; records: Surah["records"]; ui: Ui; onOpen: (records: SourceRecord[], options?: SourceOptions) => void };
const ReaderContext = createContext<ReadingProps | null>(null);
export function ReadingProvider({ value, children }: { value: ReadingProps; children: ReactNode }) {
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}
export function useReading() {
  const reading = useContext(ReaderContext);
  if (!reading) throw new Error("Reading primitives require ReadingProvider");
  return reading;
}
