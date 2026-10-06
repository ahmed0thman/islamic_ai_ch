"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Depth, Surah } from "@/lib/types";
import type { SurahMapModel } from "@/lib/map";
import type { DepthItemsModel } from "@/lib/depth-items";
import { askedStorageKey, parseAsked, serializeAsked, type AskedQuestion } from "@/lib/asked";
import { getHistory, saveProgress, saveQuestion as saveQuestionAction } from "@/lib/history/client";
import { mergeQuestions, progressDiffers, questionRecord, resumeTarget, snapshotOf, visitedToKeys, type ProgressSnapshot } from "@/lib/history/rules";

/** The gap between a move in the reading and its save; leaving the tab saves at once. */
const saveDelay = 2000;

export interface ReaderHistoryProps {
  surah: Surah;
  maps: readonly SurahMapModel[];
  items: readonly DepthItemsModel[];
  depth: Depth;
  stopNumber: number | null;
  closing: boolean;
  visited: ReadonlySet<string>;
  currentStops: Partial<Record<Depth, number>>;
}

export interface ReaderHistory {
  /** The questions this device now holds for the surah (device and account merged), or null before the account answered. */
  questions: AskedQuestion[] | null;
  /** True once a question save reached the account this visit; until then (and when signed out) the asked note stays on-device. */
  savedToAccount: boolean;
  /** The `${depth}:${blockIndex}` keys the account knows for this surah; the thread marks them visited. */
  serverVisited: ReadonlySet<string>;
  /** The place to offer resuming at, when the account holds one and the URL named none. */
  resume: { depth: Depth; stop: number } | null;
  dismissResume: () => void;
  /** Saves one asked question to the account; a failure stays silent and the note keeps today's wording. */
  saveQuestion: (entry: { question: string; atomIds: readonly string[]; depth: Depth; stop: number | null; at: number }) => void;
}

/**
 * Everything of the signed-in reader's history for one surah: one load, the merge into the device list,
 * debounced progress saves, and the resume state. Every failure stays silent, and when sign-in is off
 * (the static export) nothing is loaded, saved or written at all.
 */
export function useReaderHistory({ surah, maps, items, depth, stopNumber, closing, visited, currentStops }: ReaderHistoryProps): ReaderHistory {
  const surahNo = surah.surah.no;
  const [questions, setQuestions] = useState<AskedQuestion[] | null>(null);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [serverVisited, setServerVisited] = useState<ReadonlySet<string>>(() => new Set());
  const [resume, setResume] = useState<{ depth: Depth; stop: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const baseline = useRef<ProgressSnapshot | null>(null);
  const sent = useRef<string | null>(null);

  const unitsOf = useCallback((level: number) => maps[level]?.stops.length ? maps[level].stops : items[level]?.units ?? [], [maps, items]);

  useEffect(() => {
    setQuestions(null); setSavedToAccount(false); setSignedIn(false); setServerVisited(new Set()); setResume(null); setDismissed(false);
    baseline.current = null; sent.current = null;
  }, [surahNo]);

  useEffect(() => {
    let alive = true;
    void getHistory().then((result) => {
      if (!alive || !result || !result.ok || !result.data.signedIn) return;
      const data = result.data;
      const params = new URL(window.location.href).searchParams;
      const row = data.progress.find((item) => item.surah === surahNo);
      if (row && row.visited.length) {
        const keys = visitedToKeys(row.visited, row.depth, unitsOf(row.depth));
        if (keys.length) setServerVisited(new Set(keys));
      }
      setResume(resumeTarget(row, { d: params.get("d"), stop: params.get("stop") }, unitsOf));
      let device: AskedQuestion[] = [];
      try { device = parseAsked(localStorage.getItem(askedStorageKey(surahNo))); } catch { /* Storage is optional; the account's questions still join. */ }
      const merged = mergeQuestions(device, data.questions, surahNo);
      if (merged.length !== device.length || merged.some((item, at) => device[at] !== item)) {
        try { localStorage.setItem(askedStorageKey(surahNo), serializeAsked(merged)); } catch { /* Storage is optional. */ }
      }
      setSignedIn(true);
      setQuestions(merged);
    });
    return () => { alive = false; };
  }, [surahNo, unitsOf]);

  // The place this visit started from, so opening a surah and leaving it again saves nothing.
  const currentSnapshot = useCallback((): ProgressSnapshot => {
    const blocks = new Map(unitsOf(depth).map((unit) => [unit.blockIndex, unit.number]));
    const numbers = [...visited].filter((key) => key.startsWith(`${depth}:`))
      .flatMap((key) => { const number = blocks.get(Number(key.slice(key.indexOf(":") + 1))); return number === undefined ? [] : [number]; });
    return snapshotOf(depth, closing ? null : stopNumber, numbers);
  }, [depth, closing, stopNumber, visited, unitsOf]);

  useEffect(() => {
    if (!signedIn) return;
    const snapshot = currentSnapshot();
    if (!baseline.current) { baseline.current = snapshot; return; }
    if (!progressDiffers(baseline.current, snapshot)) return;
    const key = JSON.stringify(snapshot);
    if (sent.current === key) return;
    const send = () => {
      sent.current = key;
      void saveProgress({ surah: surahNo, depth: snapshot.depth, stop: snapshot.stop, visited: [...snapshot.visited] }).then((result) => {
        // The account now holds this place: it is the new baseline, so going back to an earlier stop is saved too.
        if (result && result.ok && result.data.saved) baseline.current = snapshot; else sent.current = null;
      });
    };
    const timer = setTimeout(send, saveDelay);
    const flush = () => { if (document.visibilityState === "hidden") { clearTimeout(timer); send(); } };
    document.addEventListener("visibilitychange", flush);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", flush); };
  }, [signedIn, surahNo, currentSnapshot]);

  const dismissResume = useCallback(() => setDismissed(true), []);

  const saveQuestion = useCallback((entry: { question: string; atomIds: readonly string[]; depth: Depth; stop: number | null; at: number }) => {
    void saveQuestionAction(questionRecord(surahNo, entry)).then((result) => {
      if (result && result.ok && result.data.saved) setSavedToAccount(true);
    });
  }, [surahNo]);

  return { questions, savedToAccount, serverVisited, resume: dismissed ? null : resume, dismissResume, saveQuestion };
}
