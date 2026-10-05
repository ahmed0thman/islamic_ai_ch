"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import mushafData from "@/content/mushaf-index.json";
import { publishedSurahs } from "@/lib/published";
import { numeral } from "@/lib/numerals";
import { ayahWords } from "@/lib/reading-text";
import { ayahLocation, groupSurahs, prepareAyahs, searchAyahs, searchKey, searchSurahs, type GroupLevel, type MushafIndex, type SurahGroup } from "@/lib/mushaf";
import { Icon } from "@/components/ui/icon";

const mushaf = mushafData as unknown as MushafIndex;
const byNo = new Map(mushaf.surahs.map((item) => [item.no, item]));
const published = new Set<number>(publishedSurahs);
const LEVELS = [{ level: "juz", label: "by_juz" }, { level: "hizb", label: "by_hizb" }, { level: "quarter", label: "by_quarter" }] as const;
const SHOWN = 20;

type Target = { surah: number; ayah?: number };
type Loaded = { prepared: string[]; words: string[]; uthmani: string[] };
type AyahState = "idle" | "loading" | "failed" | Loaded;
type Place = { position: number; surah: number; ayah: number };

// One load for the whole session: closing and reopening the menu does not fetch the text again, and nothing loads before the reader types.
let loading: Promise<Loaded> | null = null;
function loadAyahs(): Promise<Loaded> {
  loading ??= Promise.all([import("@/content/quran-plain.json"), import("@/content/quran-uthmani.json")])
    .then(([plain, uthmani]) => ({ prepared: prepareAyahs(plain.default as string[]), words: plain.default as string[], uthmani: uthmani.default as string[] }))
    .catch((error) => { loading = null; throw error; });
  return loading;
}

function SurahRow({ ui, no, current, onChoose }: { ui: Ui; no: number; current: number; onChoose: (target: Target) => void }) {
  const surah = byNo.get(no);
  if (!surah) return null;
  const open = published.has(no);
  const body = <>
    <span className="menu-surah-no">{numeral(no)}</span>
    <span className="menu-surah-name">{surah.name}</span>
    <span className="menu-surah-count" aria-label={`${ui.reader.ayahs_title}: ${numeral(surah.ayahs)}`}>{numeral(surah.ayahs)}</span>
  </>;
  if (!open) return <li><div className="menu-surah" data-closed="">{body}<span className="menu-soon">{ui.menu.soon}</span></div></li>;
  return <li><a className="menu-surah" href={`/s/${no}/`} aria-current={no === current ? "page" : undefined}
    onClick={(event) => { event.preventDefault(); onChoose({ surah: no }); }}>{body}<Icon icon={ArrowLeft01Icon} /></a></li>;
}

function groupTitle(ui: Ui, group: SurahGroup) {
  if (group.level === "juz") return <>{`${ui.menu.juz} ${numeral(group.number)}`}</>;
  const juz = <small>{`${ui.menu.juz} ${numeral(group.juz)}`}</small>;
  if (group.level === "hizb") return <>{`${ui.menu.hizb} ${numeral(group.number)}`}{juz}</>;
  return <>{`${ui.menu.hizb} ${numeral(group.hizb)} · ${ui.menu.quarter_names[group.quarterInHizb - 1]}`}{juz}</>;
}

function AyahRow({ ui, place, text, open, onChoose }: { ui: Ui; place: Place; text: string; open: boolean; onChoose: (target: Target) => void }) {
  const body = <>
    <span className="menu-ayah-text">{ayahWords(text)}</span>
    <span className="menu-ayah-ref">{`${ui.menu.surah_word} ${byNo.get(place.surah)?.name ?? ""} · ${ui.reader.unit_ayah} ${numeral(place.ayah)}`}</span>
  </>;
  if (!open) return <div className="menu-ayah" data-closed="">{body}</div>;
  return <a className="menu-ayah" href={`/s/${place.surah}/?ayah=${place.ayah}`}
    onClick={(event) => { event.preventDefault(); onChoose({ surah: place.surah, ayah: place.ayah }); }}>{body}</a>;
}

export type MushafTabProps = { ui: Ui; current: number; onChoose: (target: Target) => void };
export function MushafTab({ ui, current, onChoose }: MushafTabProps) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<GroupLevel>("juz");
  const [ayahs, setAyahs] = useState<AyahState>("idle");
  const input = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(query);
  const hasQuery = deferred.trim() !== "";
  const compact = searchKey(query).replaceAll(" ", "");
  const wantsAyahs = compact.length >= 2 && !/^\p{N}+$/u.test(compact);

  useEffect(() => {
    if (!wantsAyahs) return;
    let alive = true;
    setAyahs((state) => (typeof state === "object" ? state : "loading"));
    loadAyahs().then((value) => { if (alive) setAyahs(value); }, () => { if (alive) setAyahs("failed"); });
    return () => { alive = false; };
  }, [wantsAyahs]);

  const groups = useMemo(() => groupSurahs(mushaf, level), [level]);
  const surahHits = useMemo(() => searchSurahs(mushaf, deferred, ui.menu.surah_word), [deferred, ui.menu.surah_word]);
  const ayahHits = useMemo(() => {
    const explained: Place[] = [], rest: Place[] = [];
    let more = false;
    if (typeof ayahs !== "object") return { explained, rest, more };
    // Matches in surahs with an explanation come from all positions, so earlier matches elsewhere in the mushaf cannot hide them.
    for (const position of searchAyahs(ayahs.prepared, deferred, ayahs.prepared.length, ayahs.words).hits) {
      const place = { position, ...ayahLocation(mushaf, position) };
      if (published.has(place.surah)) { if (explained.length < SHOWN) explained.push(place); }
      else if (rest.length < SHOWN) rest.push(place);
      else more = true;
    }
    return { explained, rest, more };
  }, [ayahs, deferred]);

  // Matches in surahs without an explanation, grouped under the surah (the mushaf order keeps each surah's matches together).
  const restBySurah = useMemo(() => {
    const groups: [number, Place[]][] = [];
    for (const place of ayahHits.rest) {
      const last = groups.at(-1);
      if (last?.[0] === place.surah) last[1].push(place); else groups.push([place.surah, [place]]);
    }
    return groups;
  }, [ayahHits]);
  const text = typeof ayahs === "object" ? ayahs.uthmani : [];
  const nothing = surahHits.length === 0 && ayahHits.explained.length === 0 && ayahHits.rest.length === 0;
  const status = wantsAyahs && typeof ayahs !== "object" && ayahs !== "failed" ? ui.menu.loading_ayahs
    : wantsAyahs && ayahs === "failed" ? ui.menu.ayahs_failed
    : nothing ? ui.menu.no_results : null;
  const clear = () => { setQuery(""); input.current?.focus({ preventScroll: true }); };

  return <div className="mushaf-tab">
    <div className="menu-search" role="search">
      <Icon icon={Search01Icon} />
      <input ref={input} type="search" className="menu-search-input" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
        aria-label={ui.menu.search_label} placeholder={ui.menu.search_placeholder} value={query} onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); } }} />
      {query ? <button type="button" className="menu-search-clear" aria-label={ui.menu.search_clear} onClick={clear}><Icon icon={Cancel01Icon} /></button> : null}
    </div>
    {!hasQuery ? <p className="menu-scope">{ui.menu.scope_note}</p> : null}
    {hasQuery ? <div className="menu-results">
      {surahHits.length ? <section className="menu-section">
        <h3 className="menu-section-title">{ui.reader.surahs_title}</h3>
        <ul className="menu-list">{surahHits.map((no) => <SurahRow key={no} ui={ui} no={no} current={current} onChoose={onChoose} />)}</ul>
      </section> : null}
      {ayahHits.explained.length || ayahHits.rest.length ? <section className="menu-section">
        <h3 className="menu-section-title">{ui.reader.ayahs_title}</h3>
        {ayahHits.explained.length ? <>
          <h4 className="menu-group-title">{ui.menu.results_explained}</h4>
          {ayahHits.explained.map((place) => <AyahRow key={place.position} ui={ui} place={place} text={text[place.position]} open onChoose={onChoose} />)}
        </> : null}
        {restBySurah.map(([surah, places]) => <div key={surah}>
          <h4 className="menu-group-title"><span>{byNo.get(surah)?.name}</span><span className="menu-soon">{ui.menu.soon}</span></h4>
          {places.map((place) => <AyahRow key={place.position} ui={ui} place={place} text={text[place.position]} open={false} onChoose={onChoose} />)}
        </div>)}
        {ayahHits.more ? <p className="menu-note">{ui.menu.more_results}</p> : null}
      </section> : null}
      {status ? <p className="menu-status" role="status">{status}</p> : null}
    </div> : <>
      <section className="menu-section">
        <h3 className="menu-section-title">{ui.menu.available_title}</h3>
        <ul className="menu-list">{publishedSurahs.map((no) => <SurahRow key={no} ui={ui} no={no} current={current} onChoose={onChoose} />)}</ul>
      </section>
      <section className="menu-section">
        <h3 className="menu-section-title">{ui.menu.all_title}</h3>
        <div className="menu-levels" role="group" aria-label={ui.menu.group_by}>
          {LEVELS.map((item) => <button type="button" key={item.level} className="menu-level" aria-pressed={level === item.level} onClick={() => setLevel(item.level)}>{ui.menu[item.label]}</button>)}
        </div>
        {groups.map((group) => <section className="menu-group" key={`${group.level}-${group.number}`}>
          <h4 className="menu-group-title">{groupTitle(ui, group)}</h4>
          {group.continues !== null ? <p className="menu-continues">{`${ui.menu.continues} ${byNo.get(group.continues)?.name ?? ""} · ${ui.menu.from_ayah} ${numeral(group.start.ayah)}`}</p> : null}
          <ul className="menu-list">{group.surahs.map((no) => <SurahRow key={no} ui={ui} no={no} current={current} onChoose={onChoose} />)}</ul>
        </section>)}
      </section>
    </>}
  </div>;
}
