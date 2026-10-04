"use client";

import { useEffect, useMemo, useState } from "react";
import type { Depth, SourceRecord, Surah, SurahSummary, Ui } from "@/lib/types";
import { deriveSurahMap, stopNeighbours, type MapStop } from "@/lib/map";
import { relationRecords } from "@/lib/relations";
import { scopeStart, type Scope } from "@/lib/scope";
import { jumpToAyah } from "@/lib/reader-dom";
import { useSheets } from "./sheet-provider";
import { ReadingProvider } from "./reading-context";
import { SurahHeader } from "./surah-header";
import { HeroQuestion } from "./hero-question";
import { DepthDial } from "./depth-dial";
import { MiniStrip } from "./mini-strip";
import { ViewToggle } from "./view-toggle";
import { SurahThread } from "./surah-thread";
import { StopScene } from "./stop-scene";
import { AyahStage } from "./ayah-stage";
import { ContinuousView } from "./continuous-view";

const storageKey = "huda:depth:v1";
const viewStorageKey = "huda:reader-view:v1";
type ReadingView = "map" | "text";
function parseDepth(value: string | null): Depth | null {
  return value !== null && /^[0-3]$/.test(value) ? Number(value) as Depth : null;
}
function remember(depth: Depth) {
  try { localStorage.setItem(storageKey, String(depth)); } catch { /* Reading works when storage is unavailable. */ }
}
function rememberView(view: ReadingView) {
  try { localStorage.setItem(viewStorageKey, view); } catch { /* Optional device preference. */ }
}
function updateUrl(depth: Depth, stop: number | null, text: boolean, push: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.set("d", String(depth));
  if (stop !== null) url.searchParams.set("stop", String(stop)); else url.searchParams.delete("stop");
  if (text) url.searchParams.set("view", "text"); else url.searchParams.delete("view");
  const state = { ...window.history.state };
  if (stop === null) delete state.hudaScene;
  if (push && stop !== null) state.hudaScene = true;
  if (push) window.history.pushState(state, "", url);
  else window.history.replaceState(state, "", url);
}
export function Reader({ surah, ui, nextSurah, surahs }: { surah: Surah; ui: Ui; surahs: SurahSummary[]; nextSurah?: SurahSummary }) {
  const [depth, setDepth] = useState<Depth>(1);
  const [currentAyah, setCurrentAyah] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>({ kind: "surah" });
  const [view, setView] = useState<ReadingView>("map");
  const [stopNumber, setStopNumber] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [currentStops, setCurrentStops] = useState<Partial<Record<Depth, number>>>({});
  const { openSource, openUnit } = useSheets();
  const maps = useMemo(() => ([0, 1, 2, 3] as const).map((level) => deriveSurahMap(surah, level)), [surah]);
  const ayahs = useMemo(() => new Map(surah.ayahs.map((ayah) => [ayah.key, ayah])), [surah.ayahs]);
  useEffect(() => {
    function restore(useSavedView: boolean) {
      let saved: Depth | null = null;
      let savedView: ReadingView = "map";
      try {
        saved = parseDepth(localStorage.getItem(storageKey));
        savedView = localStorage.getItem(viewStorageKey) === "text" ? "text" : "map";
      } catch { /* Optional device preferences. */ }
      const params = new URL(window.location.href).searchParams;
      const next = parseDepth(params.get("d")) ?? saved ?? 1;
      const map = maps[next];
      const canOpenScene = map.stops.length > 0 && next !== 3;
      const rawStop = params.get("stop");
      const requestedStop = rawStop && /^[1-9]\d*$/.test(rawStop) ? Number(rawStop) : null;
      const requestedView = params.get("view");
      const nextView: ReadingView = requestedView === "text" ? "text"
        : requestedStop !== null || requestedView === "map" ? "map"
        : useSavedView ? savedView : "map";
      const stop = canOpenScene && nextView === "map"
        ? map.stops.find((item) => item.number === requestedStop) : undefined;
      setDepth(next); setView(nextView); setStopNumber(stop?.number ?? null);
      if (stop) {
        setVisited((previous) => new Set(previous).add(`${next}:${stop.blockIndex}`));
        setCurrentStops((previous) => ({ ...previous, [next]: stop.number }));
      }
      remember(next);
      updateUrl(next, stop?.number ?? null, next === 3 || nextView === "text" || !map.stops.length, false);
    }
    restore(true);
    const popstate = () => { if (!document.documentElement.hasAttribute("data-huda-sheet-open")) restore(false); };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, [maps]);
  const level = surah.levels[depth];
  const map = maps[depth];
  const showMap = depth !== 3 && map.stops.length > 0 && view === "map";
  const stop = showMap ? map.stops.find((item) => item.number === stopNumber) : undefined;
  const neighbours = stop ? stopNeighbours(map, stop.number) : { previous: undefined, next: undefined };
  const visitedNumbers = new Set(map.stops.filter((item) => visited.has(`${depth}:${item.blockIndex}`)).map((item) => item.number));
  const reading = { surahNo: surah.surah.no, relations: relationRecords(surah, depth), ayahs, records: surah.records, ui, onOpen: openSource };
  useEffect(() => {
    if (stop || view === "text") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.filter((item) => item.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - window.innerHeight / 2) - Math.abs(b.boundingClientRect.top - window.innerHeight / 2))[0];
      if (entry) setCurrentAyah((entry.target as HTMLElement).dataset.stationKey ?? null);
    }, { rootMargin: "-38% 0px -52% 0px" });
    document.querySelectorAll("[data-station-key]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [stop, view, map]);
  function chooseScope(next: Scope) { setScope(next); window.requestAnimationFrame(() => jumpToAyah(scopeStart(surah, next))); }
  function jump(key: string) { if (depth !== 3 && view !== "map") chooseView("map"); window.requestAnimationFrame(() => jumpToAyah(key)); }
  function openStop(next: MapStop) {
    setStopNumber(next.number);
    setVisited((previous) => new Set(previous).add(`${depth}:${next.blockIndex}`));
    setCurrentStops((previous) => ({ ...previous, [depth]: next.number }));
    updateUrl(depth, next.number, false, stopNumber === null);
  }
  function backToMap() {
    if (window.history.state?.hudaScene) window.history.back();
    else { setStopNumber(null); updateUrl(depth, null, false, false); }
  }
  function chooseView(next: ReadingView) {
    setView(next); setStopNumber(null); rememberView(next);
    updateUrl(depth, null, next === "text", true);
  }
  const startNumber = Number(scopeStart(surah, scope).split(":")[1]);
  const hero = map.stops.find((item) => Number(item.stationKey.split(":")[1]) >= startNumber);
  const passage = stop ? surah.passages?.find((item) => item.id === stop.passage) : undefined;
  const nextPassage = neighbours.next && neighbours.next.passage !== stop?.passage ? surah.passages?.find((item) => item.id === neighbours.next!.passage) : undefined;
  return <ReadingProvider value={reading}><div className="huda-reader">
    <SurahHeader surah={surah} surahs={surahs} scope={scope} ui={ui} onOpenUnit={() => openUnit(surah, scope, chooseScope)} />
    {showMap ? <div className="hero-area"><HeroQuestion stop={hero} ui={ui} onOpen={openStop} /></div> : null}
    <div className="console">
      {depth !== 3 ? <MiniStrip groups={map.groups} depthPins={Object.fromEntries(map.groups.flatMap((group) => group.stations.map((station) => [station.ayah.key, station.stops.length])))} current={currentAyah} scope={scope} onJump={jump} onScope={chooseScope} ariaLabel={ui.reader.ayahs_title} /> : null}
      <DepthDial depth={depth} levels={ui.levels} label={ui.reader.choose_depth} onChange={(next) => { setDepth(next); setStopNumber(null); remember(next); updateUrl(next, null, view === "text" || next === 3, true); }} />
    </div>
    {depth !== 3 && map.stops.length > 0 ? <ViewToggle view={view} ui={ui} onChange={chooseView} /> : null}
    <article className="reading-body" aria-label={ui.levels.find((item) => item.depth === depth)!.name}>
      {showMap ? <SurahThread map={map} scope={scope} onScope={chooseScope} onAyah={(key) => openUnit(surah, { kind: "ayah", key }, chooseScope)} ui={ui} visited={visitedNumbers} currentStop={currentStops[depth] ?? null} hidden={Boolean(stop)} onOpen={openStop} />
        : level.blocks.length ? <><AyahStage ayahs={map.groups.flatMap((group) => group.stations.map((station) => station.ayah))} ui={ui} focusKey={scopeStart(surah, scope)} /><div className="reader-text"><ContinuousView key={depth} blocks={map.continuousBlocks} {...reading} /></div></> : <p className="reader-text">{ui.reader.empty_level}</p>}
    </article>
    {stop ? <StopScene stop={stop} stops={map.stops} passage={passage} nextPassage={nextPassage} {...neighbours} nextSurah={nextSurah} onNavigate={openStop} onBack={backToMap} {...reading} /> : null}
  </div></ReadingProvider>;
}
