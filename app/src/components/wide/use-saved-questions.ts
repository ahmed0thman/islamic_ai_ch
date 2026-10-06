"use client";

import { useEffect, useState } from "react";
import { askedStorageKey, parseAsked, type AskedQuestion } from "@/lib/asked";
import { useAsk } from "@/components/reader/ask-state";

/** Weave can be enabled independently of Ask; the phone also uses questions already on this device. */
export function useSavedQuestions(surahNo: number) {
  const ask = useAsk();
  const [questions, setQuestions] = useState<AskedQuestion[]>([]);
  useEffect(() => {
    const key = askedStorageKey(surahNo);
    const read = () => { try { setQuestions(parseAsked(localStorage.getItem(key))); } catch { setQuestions([]); } };
    const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    read(); window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [surahNo, ask?.entries]);
  return questions;
}
