"use client";

import Link from "next/link";
import { ArrowRight01Icon, BookOpen01Icon, MapsIcon } from "@hugeicons/core-free-icons";
import { Icon } from "./ui/icon";
import { Button } from "./ui/button";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Ayah, Block, Depth, Segment, SourceRecord, Surah, SurahSummary, Ui } from "@/lib/types";
import { deriveSurahMap, stopNeighbours, type MapStop } from "@/lib/map";
import { Marker } from "./marks";
import { useSheets } from "./reader/sheet-provider";
import { SurahMap } from "./surah-map";
import { StopScene } from "./stop-scene";
import { GlanceCard } from "./glance-card";
import { numeral } from "@/lib/numerals";

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
  if (push) window.history.pushState(window.history.state, "", url);
  else window.history.replaceState(window.history.state, "", url);
}
// The Complex file ends each ayah with a number glyph that only its own font draws;
// the number is shown separately, so the trailing glyph is dropped. The ayah's words are untouched.
const ayahWords = (text: string) => text.replace(/[\s\u00a0]*[\ufb50-\ufdcf]+$/u, "");
// Split only at the last word so a marker never forces a whole claim onto one line.
function splitLastWord(text: string): [string, string] {
  const tail = text.match(/\S+\s*$/u)?.[0] ?? text;
  return [text.slice(0, text.length - tail.length), tail];
}
export function AyahText({ ayah, inline = false, part = "whole" }: { ayah: Ayah; inline?: boolean; part?: "whole" | "start" | "end" }) {
  const words = ayahWords(ayah.text);
  const [start, end] = splitLastWord(words);
  return <span className={inline ? "quran inline-ayah" : "quran ayah-text"}>
    <span>{part === "whole" ? words : part === "start" ? start : end}</span>
    {part !== "start" ? <>{"\u00a0"}<span className="ayah-number">{numeral(ayah.no)}</span></> : null}
  </span>;
}
export type ReadingProps = {
  ayahs: Map<string, Ayah>; records: Surah["records"]; ui: Ui; onOpen: (records: SourceRecord[]) => void;
};
export function ContentBlock({ block, showTitle = true, ...props }: ReadingProps & { block: Block; showTitle?: boolean }) {
  const { ayahs, ui } = props;
  if (block.type === "heading") return <h2 className={block.kind === "question" ? "reading-heading reading-question" : "reading-heading"}>{block.text}</h2>;
  if (block.type === "ayah") return <section className="ayah-block" aria-label={ui.reader.ayahs_title}>
    {block.keys.map((key) => <AyahText key={key} ayah={ayahs.get(key)!} />)}
  </section>;
  if (block.type === "details") return <details className="reading-details">
    <summary className="reading-summary"><ReadingSegments segments={block.title} {...props} /></summary>
    <div className="reading-details-body">{block.blocks.map((inner, i) => <ContentBlock key={i} block={inner} {...props} />)}</div>
  </details>;
  const paragraph = <p className={block.role === "transmission" ? "reading-paragraph transmission" : "reading-paragraph"}>
    <ReadingSegments segments={block.segments} {...props} />
  </p>;
  // A titled paragraph is a stop: in continuous reading its title shows as the question above it.
  return block.title && showTitle ? <><h2 className="reading-heading reading-question">{block.title}</h2>{paragraph}</> : paragraph;
}
function ReadingSegments({ segments: input, ayahs, records, ui, onOpen }: ReadingProps & { segments: Segment[] }) {
  const segments = [...input];
  const nodes: ReactNode[] = [];
  segments.forEach((segment, i) => {
    const followedByMarker = segments[i + 1]?.t === "mark";
    if (segment.t === "text" || segment.t === "quote") {
      const [start, end] = followedByMarker ? splitLastWord(segment.v) : ["", segment.v];
      if (segment.t === "text") {
        if (start) nodes.push(<span key={`${i}-start`}>{start}</span>);
        nodes.push(<span key={i}>{end}</span>);
      } else {
        if (start) nodes.push(<q key={`${i}-start`} className="verbatim quote-start" data-record={segment.record}>{start}</q>);
        nodes.push(<q key={i} className={start ? "verbatim quote-end" : "verbatim"} data-record={segment.record}>{end}</q>);
      }
    } else if (segment.t === "ayah") {
      if (followedByMarker) nodes.push(<AyahText key={`${i}-start`} ayah={ayahs.get(segment.key)!} inline part="start" />);
      nodes.push(<AyahText key={i} ayah={ayahs.get(segment.key)!} inline part={followedByMarker ? "end" : "whole"} />);
    } else if (segment.t === "term") {
      // Keep the interactive term attached to the following marker and punctuation.
      nodes.push(<button key={i} type="button" className="reading-term" aria-haspopup="dialog" onClick={(event) => {
        event.stopPropagation(); onOpen([records[segment.record]]);
      }}>{segment.v}</button>);
    } else {
      const sources = [...new Set(segment.records)].map((id) => records[id]);
      const preceding = nodes.pop();
      const next = segments[i + 1];
      const punctuation = next?.t === "text" ? next.v.match(/^\s*\p{P}+/u)?.[0] ?? "" : "";
      if (next?.t === "text" && punctuation) segments[i + 1] = { ...next, v: next.v.slice(punctuation.length) };
      nodes.push(<span key={`claim-${i}`} className="claim-ending">{preceding}<Marker records={sources} ui={ui} onOpen={() => onOpen(sources)} />{punctuation}</span>);
    }
  });
  return <>{nodes}</>;
}
export function Reader({ surah, ui, nextSurah }: { surah: Surah; ui: Ui; nextSurah?: SurahSummary }) {
  const [depth, setDepth] = useState<Depth>(1);
  const [view, setView] = useState<ReadingView>("map");
  const [stopNumber, setStopNumber] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [currentStops, setCurrentStops] = useState<Partial<Record<Depth, number>>>({});
  const { openSource } = useSheets();
  const setSelected = (records: SourceRecord[] | null) => { if (records) openSource(records); };
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
      const switchable = next === 1 || next === 2;
      const canOpenScene = map.stops.length > 0 && (switchable || (next === 0 && map.stops.length > 2));
      const rawStop = params.get("stop");
      const requestedStop = rawStop && /^[1-9]\d*$/.test(rawStop) ? Number(rawStop) : null;
      const requestedView = params.get("view");
      const nextView: ReadingView = requestedView === "text" ? "text"
        : requestedStop !== null || requestedView === "map" ? "map"
        : useSavedView || !switchable ? savedView : "map";
      const stop = canOpenScene && (!switchable || nextView === "map")
        ? map.stops.find((item) => item.number === requestedStop) : undefined;
      setDepth(next); setView(nextView); setStopNumber(stop?.number ?? null); setSelected(null);
      if (stop) {
        setVisited((previous) => new Set(previous).add(`${next}:${stop.blockIndex}`));
        setCurrentStops((previous) => ({ ...previous, [next]: stop.number }));
      }
      remember(next);
      updateUrl(next, stop?.number ?? null, switchable && (nextView === "text" || !map.stops.length), false);
    }
    restore(true);
    const popstate = () => { if (!document.documentElement.hasAttribute("data-huda-sheet-open")) restore(false); };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, [maps]);
  const level = surah.levels[depth];
  const map = maps[depth];
  const switchable = depth === 1 || depth === 2;
  const showMap = map.stops.length > 0 && (switchable ? view === "map" : depth === 0 && map.stops.length > 2);
  const stop = showMap ? map.stops.find((item) => item.number === stopNumber) : undefined;
  const neighbours = stop ? stopNeighbours(map, stop.number) : {};
  const visitedNumbers = new Set(map.stops.filter((item) => visited.has(`${depth}:${item.blockIndex}`)).map((item) => item.number));
  const reading = { ayahs, records: surah.records, ui, onOpen: setSelected };
  const glance = depth === 0 && map.stops.length > 0 && map.stops.length <= 2
    ? map.stops.reduce((first, item) => item.blockIndex < first.blockIndex ? item : first) : undefined;

  function openStop(next: MapStop) {
    setStopNumber(next.number); setSelected(null);
    setVisited((previous) => new Set(previous).add(`${depth}:${next.blockIndex}`));
    setCurrentStops((previous) => ({ ...previous, [depth]: next.number }));
    updateUrl(depth, next.number, false, true);
  }
  function backToMap() {
    setStopNumber(null); setSelected(null); updateUrl(depth, null, false, true);
  }
  function chooseView(next: ReadingView) {
    setView(next); setStopNumber(null); setSelected(null); rememberView(next);
    updateUrl(depth, null, next === "text", true);
  }
  return <>
    <header className="reader-header">
      <Link className="back-link" href="/" prefetch={false}><Icon icon={ArrowRight01Icon} />{ui.reader.back}</Link>
      <p className="eyebrow">{ui.app_name}<span className="header-divider" aria-hidden="true"> / </span>{numeral(surah.surah.no)}</p>
      <h1>{surah.surah.name}</h1>
      <fieldset className="depth-switch">
        <legend>{ui.reader.choose_depth}</legend>
        <div className="depth-options">
          {ui.levels.map((item) => <label key={item.depth} className={depth === item.depth ? "depth-option is-selected" : "depth-option"}>
            <input type="radio" name="depth" value={item.depth} checked={depth === item.depth} onChange={() => {
              setDepth(item.depth); setStopNumber(null); setSelected(null); remember(item.depth);
              updateUrl(item.depth, null, (item.depth === 1 || item.depth === 2) && (view === "text" || !maps[item.depth].stops.length), true);
            }} />
            <span>{item.name}</span>
          </label>)}
        </div>
      </fieldset>
    </header>
    {switchable && map.stops.length > 0 ? <div className="reader-view-switch">
      <Button variant="pill" aria-pressed={view === "map"} onClick={() => chooseView("map")}><Icon icon={MapsIcon} />{ui.reader.map_view}</Button>
      <Button variant="pill" aria-pressed={view === "text"} onClick={() => chooseView("text")}><Icon icon={BookOpen01Icon} />{ui.reader.read_continuous}</Button>
    </div> : null}
    <article className="reading-body" aria-label={ui.levels.find((item) => item.depth === depth)!.name}>
      {showMap ? <>
        <SurahMap key={depth} map={map} ui={ui} visited={visitedNumbers} currentStop={currentStops[depth] ?? null} hidden={Boolean(stop)} onOpen={openStop} />
        {stop ? <StopScene stop={stop} {...neighbours} nextSurah={nextSurah} onNavigate={openStop} onBack={backToMap} {...reading} /> : null}
      </> : glance ? <GlanceCard stop={glance} ayahKeys={map.groups.flatMap((group) => group.stations.map((station) => station.ayah.key))} {...reading} />
        : level.blocks.length ? map.continuousBlocks.map((block, i) => <ContentBlock key={`${depth}-${i}`} block={block} {...reading} />)
        : <p>{ui.reader.empty_level}</p>}
    </article>
  </>;
}
