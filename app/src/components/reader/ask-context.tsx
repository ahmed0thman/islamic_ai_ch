"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Depth, Surah } from "@/lib/types";
import { addAsked, askedStorageKey, parseAsked, removeAsked, resolveAsked, serializeAsked, type AskedQuestion } from "@/lib/asked";
import { deriveAtoms } from "@/lib/ask/atoms";
import { AskContext, type AskState, type AskStop } from "./ask-state";
import { AskSheet } from "./ask-sheet";

function readStored(surahNo: number): AskedQuestion[] {
  try { return parseAsked(localStorage.getItem(askedStorageKey(surahNo))); } catch { return []; }
}
function writeStored(surahNo: number, list: AskedQuestion[]) {
  try { localStorage.setItem(askedStorageKey(surahNo), serializeAsked(list)); } catch { /* Optional: the answer still shows when the device refuses storage. */ }
}
export function AskProvider({ enabled, surah, depth, stop, children }: { enabled: boolean; surah: Surah; depth: Depth; stop: AskStop | null; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <Enabled surah={surah} depth={depth} stop={stop}>{children}</Enabled>;
}
function Enabled({ surah, depth, stop, children }: { surah: Surah; depth: Depth; stop: AskStop | null; children: ReactNode }) {
  const surahNo = surah.surah.no;
  const [list, setList] = useState<AskedQuestion[]>([]);
  const [sheet, setSheet] = useState(false);
  // Read after mount: the server cannot know what a device holds.
  useEffect(() => { setList(readStored(surahNo)); }, [surahNo]);
  const atoms = useMemo(() => new Map(deriveAtoms(surah).map((atom) => [atom.id, atom])), [surah]);
  const entries = useMemo(() => resolveAsked(list, atoms), [list, atoms]);
  const open = useCallback(() => setSheet(true), []);
  const save = useCallback(({ question, atomIds }: { question: string; atomIds: string[] }) => {
    // Merge with what storage holds now, so a second tab's questions are not overwritten.
    const next = addAsked(readStored(surahNo), { question, atomIds, depth, stop: stop?.number ?? null, at: Date.now() });
    writeStored(surahNo, next);
    setList(next);
  }, [surahNo, depth, stop?.number]);
  const remove = useCallback((id: string) => {
    const next = removeAsked(readStored(surahNo), id);
    writeStored(surahNo, next);
    setList(next);
  }, [surahNo]);
  const value = useMemo<AskState>(() => ({ depth, stop, entries, open, save, remove }), [depth, stop, entries, open, save, remove]);
  return <AskContext.Provider value={value}>
    {children}
    {sheet ? <AskSheet surahNo={surahNo} onClose={() => setSheet(false)} /> : null}
  </AskContext.Provider>;
}
