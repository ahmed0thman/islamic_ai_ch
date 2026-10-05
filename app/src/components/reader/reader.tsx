"use client";

import { useEffect, useMemo, useState } from "react";
import type { Depth, SourceRecord, Surah, SurahSummary, Ui } from "@/lib/types";
import { deriveSurahMap, heroStop } from "@/lib/map";
import { deriveDepthItems, depthHero, depthPlaylist, sceneNeighbours, type SceneUnit } from "@/lib/depth-items";
import { relationRecords } from "@/lib/relations";
import { deriveTermsSummary } from "@/lib/terms-summary";
import { scopeContains, scopeStart, type Scope } from "@/lib/scope";
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
import { ContinuousView } from "./continuous-view";
import { TermsSummary } from "./terms-summary";

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
  const [settled, setSettled] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [currentStops, setCurrentStops] = useState<Partial<Record<Depth, number>>>({});
  const { openSource, openUnit } = useSheets();
  const maps = useMemo(() => ([0, 1, 2, 3] as const).map((level) => deriveSurahMap(surah, level)), [surah]);
  const itemModels = useMemo(() => ([0, 1, 2, 3] as const).map((level) => deriveDepthItems(surah, level)), [surah]);
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
      const units: SceneUnit[] = maps[next].stops.length ? maps[next].stops : itemModels[next].units;
      const canOpenScene = units.length > 0;
      const rawStop = params.get("stop");
      const requestedStop = rawStop && /^[1-9]\d*$/.test(rawStop) ? Number(rawStop) : null;
      const requestedView = params.get("view");
      const nextView: ReadingView = requestedView === "text" ? "text"
        : requestedStop !== null || requestedView === "map" ? "map"
        : useSavedView ? savedView : "map";
      const stop = canOpenScene && nextView === "map"
        ? units.find((item) => item.number === requestedStop) : undefined;
      setDepth(next); setView(nextView); setStopNumber(stop?.number ?? null);
      if (stop) {
        setVisited((previous) => new Set(previous).add(`${next}:${stop.blockIndex}`));
        setCurrentStops((previous) => ({ ...previous, [next]: stop.number }));
      }
      remember(next);
      updateUrl(next, stop?.number ?? null, nextView === "text" || !units.length, false);
    }
    restore(true);
    const popstate = () => { if (!document.documentElement.hasAttribute("data-huda-sheet-open")) restore(false); };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, [maps, itemModels]);
  // The hero swaps its title without a cross-fade until the first restore of the saved depth has painted.
  useEffect(() => { const frame = window.requestAnimationFrame(() => setSettled(true)); return () => window.cancelAnimationFrame(frame); }, []);
  const level = surah.levels[depth];
  // What this level teaches, from its own term segments and their records.
  const termsSummary = useMemo(() => deriveTermsSummary(level.blocks, surah.records, ui.sciences), [level, surah.records, ui.sciences]);
  const map = maps[depth];
  const items = itemModels[depth];
  // A level with titled stops walks its stops; a level without them (depth 3) walks its depth items.
  const units: SceneUnit[] = map.stops.length ? map.stops : items.units;
  const mapped = units.length > 0;
  const showMap = mapped && view === "map";
  const stop = showMap ? units.find((item) => item.number === stopNumber) : undefined;
  // The scene walks the weaving in its own order, so the opening question is followed by the paragraph the text puts second.
  const playlist: SceneUnit[] = stop?.kind ? depthPlaylist(items, stop) : [...map.stops].sort((a, b) => a.blockIndex - b.blockIndex);
  const neighbours = stop ? sceneNeighbours(playlist, stop.number) : { previous: undefined, next: undefined };
  const visitedNumbers = new Set(units.filter((item) => visited.has(`${depth}:${item.blockIndex}`)).map((item) => item.number));
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
  function jump(key: string) { if (mapped && view !== "map") chooseView("map"); window.requestAnimationFrame(() => jumpToAyah(key)); }
  function openStop(next: SceneUnit) {
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
  const passages = surah.passages ?? [];
  const hero: SceneUnit | undefined = map.stops.length ? heroStop(map.stops, (key) => scopeContains(key, scope, passages), startNumber) : depthHero(items, startNumber, scope.kind === "surah");
  const passage = stop ? surah.passages?.find((item) => item.id === stop.passage) : undefined;
  const nextPassage = neighbours.next && neighbours.next.passage !== stop?.passage ? surah.passages?.find((item) => item.id === neighbours.next!.passage) : undefined;
  return <ReadingProvider value={reading}><div className="huda-reader">
    <SurahHeader surah={surah} surahs={surahs} scope={scope} ui={ui} onOpenUnit={() => openUnit(surah, scope, chooseScope)} />
    {showMap && hero ? <div className="hero-area"><HeroQuestion stop={hero} ui={ui} animate={settled} onOpen={openStop} /></div> : null}
    <div className="console">
      {depth !== 3 || mapped ? <MiniStrip groups={map.groups} depthPins={Object.fromEntries(map.groups.flatMap((group) => group.stations.map((station) => [station.ayah.key, station.stops.length])))} itemPins={items.pins.reduce<Record<string, number>>((counts, pin) => ({ ...counts, [pin.stationKey]: (counts[pin.stationKey] ?? 0) + 1 }), {})} current={currentAyah} scope={scope} onJump={jump} onScope={chooseScope} ariaLabel={ui.reader.ayahs_title} /> : null}
      <DepthDial depth={depth} levels={ui.levels} label={ui.reader.choose_depth} onChange={(next) => { setDepth(next); setStopNumber(null); remember(next); updateUrl(next, null, view === "text" || !(maps[next].stops.length || itemModels[next].units.length), true); }} />
    </div>
    {mapped ? <ViewToggle view={view} ui={ui} onChange={chooseView} /> : null}
    <article className="reading-body" aria-label={ui.levels.find((item) => item.depth === depth)!.name}>
      {showMap ? <><SurahThread map={map} items={items} scope={scope} onScope={chooseScope} onAyah={(key) => openUnit(surah, { kind: "ayah", key }, chooseScope)} ui={ui} visited={visitedNumbers} currentStop={currentStops[depth] ?? null} hidden={Boolean(stop)} onOpen={openStop} />
          {termsSummary ? <TermsSummary summary={termsSummary} ui={ui} hidden={Boolean(stop)} onOpen={openSource} /> : null}</>
        : level.blocks.length ? <div className="reader-text"><ContinuousView key={depth} blocks={map.continuousBlocks} {...reading} />{termsSummary ? <TermsSummary summary={termsSummary} ui={ui} onOpen={openSource} /> : null}</div> : <p className="reader-text">{ui.reader.empty_level}</p>}
    </article>
    {stop ? <StopScene stop={stop} stops={playlist} passage={passage} nextPassage={nextPassage} termsSummary={termsSummary} {...neighbours} nextSurah={nextSurah} onNavigate={openStop} onBack={backToMap} {...reading} /> : null}
  </div></ReadingProvider>;
}
