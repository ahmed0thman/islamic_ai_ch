"use client";

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import type { Depth, Surah } from "@/lib/types";
import { addAsked, askedStorageKey, parseAsked, removeAsked, resolveAsked, serializeAsked, type AskedQuestion } from "@/lib/asked";
import { deriveAtoms } from "@/lib/ask/atoms";
import { AskContext, type AskState, type AskStop, type AskTurn } from "./ask-state";
import { AskSheet } from "./ask-sheet";
import type { AskResponse } from "@/lib/ask/types";

function readStored(surahNo: number): AskedQuestion[] {
  try { return parseAsked(localStorage.getItem(askedStorageKey(surahNo))); } catch { return []; }
}
function writeStored(surahNo: number, list: AskedQuestion[]) {
  try { localStorage.setItem(askedStorageKey(surahNo), serializeAsked(list)); } catch { /* Optional: the answer still shows when the device refuses storage. */ }
}
export function AskProvider({ enabled, surah, depth, stop, starters = [], children }: { enabled: boolean; surah: Surah; depth: Depth; stop: AskStop | null; starters?: string[]; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <Enabled surah={surah} depth={depth} stop={stop} starters={starters}>{children}</Enabled>;
}
function Enabled({ surah, depth, stop, starters, children }: { surah: Surah; depth: Depth; stop: AskStop | null; starters: string[]; children: ReactNode }) {
  const surahNo = surah.surah.no;
  const [list, setList] = useState<AskedQuestion[]>([]);
  const [sheet, setSheet] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const nextId = useRef(1);

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

  const addTurn = useCallback((question: string) => {
    const id = nextId.current++;
    setTurns((prev) => {
      const next = [...prev, { id, question, loading: true, result: null }];
      return next.slice(-20);
    });
    return id;
  }, []);

  const settleTurn = useCallback((id: number, result: AskResponse) => {
    setTurns((prev) => prev.map((turn) => turn.id === id ? { ...turn, loading: false, result } : turn));
  }, []);

  const dropTurn = useCallback((id: number) => {
    setTurns((prev) => prev.filter((turn) => turn.id !== id));
  }, []);

  const value = useMemo<AskState>(() => ({
    depth, stop, entries, open, save, remove,
    turns, starters, addTurn, settleTurn, dropTurn
  }), [depth, stop, entries, open, save, remove, turns, starters, addTurn, settleTurn, dropTurn]);

  return <AskContext.Provider value={value}>
    {children}
    {sheet ? <AskSheet surahNo={surahNo} onClose={() => setSheet(false)} /> : null}
  </AskContext.Provider>;
}
