"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ayah, Block, Depth, SourceRecord, Surah, Ui } from "@/lib/types";
import { Marker } from "./marks";
import { SourcePanel } from "./source-panel";

const storageKey = "huda:depth:v1";
function parseDepth(value: string | null): Depth | null {
  return value !== null && /^[0-3]$/.test(value) ? Number(value) as Depth : null;
}
function remember(depth: Depth) {
  try { localStorage.setItem(storageKey, String(depth)); } catch { /* Reading works when storage is unavailable. */ }
}
function updateUrl(depth: Depth, push: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.set("d", String(depth));
  if (push) window.history.pushState(window.history.state, "", url);
  else window.history.replaceState(window.history.state, "", url);
}
const numeral = (value: number) => value.toLocaleString("ar");
// The Complex file ends each ayah with a number glyph that only its own font draws;
// the number is shown separately, so the trailing glyph is dropped. The ayah's words are untouched.
const ayahWords = (text: string) => text.replace(/[\s\u00a0]*[\ufb50-\ufdcf]+$/u, "");
function AyahText({ ayah, inline = false }: { ayah: Ayah; inline?: boolean }) {
  return <span className={inline ? "quran inline-ayah" : "quran ayah-text"}>
    <span>{ayahWords(ayah.text)}</span>{" "}<span className="ayah-number">{numeral(ayah.no)}</span>
  </span>;
}
function ContentBlock({ block, ayahs, records, ui, onOpen }: {
  block: Block; ayahs: Map<string, Ayah>; records: Surah["records"]; ui: Ui; onOpen: (records: SourceRecord[]) => void;
}) {
  if (block.type === "heading") return <h2 className="reading-heading">{block.text}</h2>;
  if (block.type === "ayah") return <section className="ayah-block" aria-label={ui.reader.ayahs_title}>
    {block.keys.map((key) => <AyahText key={key} ayah={ayahs.get(key)!} />)}
  </section>;
  return <p className={block.role === "transmission" ? "reading-paragraph transmission" : "reading-paragraph"}>
    {block.segments.map((segment, i) => {
      switch (segment.t) {
        case "text": return <span key={i}>{segment.v}</span>;
        case "ayah": return <AyahText key={i} ayah={ayahs.get(segment.key)!} inline />;
        case "quote": return <q key={i} className="verbatim" data-record={segment.record}>{segment.v}</q>;
        case "mark": {
          const sources = [...new Set(segment.records)].map((id) => records[id]);
          return <Marker key={i} records={sources} ui={ui} onOpen={() => onOpen(sources)} />;
        }
      }
    })}
  </p>;
}
export function Reader({ surah, ui }: { surah: Surah; ui: Ui }) {
  const [depth, setDepth] = useState<Depth>(1);
  const [selected, setSelected] = useState<SourceRecord[] | null>(null);
  const ayahs = useMemo(() => new Map(surah.ayahs.map((ayah) => [ayah.key, ayah])), [surah.ayahs]);
  const closePanel = useCallback(() => setSelected(null), []);
  useEffect(() => {
    function restore() {
      let saved: Depth | null = null;
      try { saved = parseDepth(localStorage.getItem(storageKey)); } catch { /* Optional device preference. */ }
      const next = parseDepth(new URL(window.location.href).searchParams.get("d")) ?? saved ?? 1;
      setDepth(next); setSelected(null); remember(next); updateUrl(next, false);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const level = surah.levels[depth];
  return <>
    <header className="reader-header">
      <Link className="back-link" href="/" prefetch={false}><span aria-hidden="true">→ </span>{ui.reader.back}</Link>
      <p className="eyebrow">{ui.app_name}<span className="header-divider" aria-hidden="true"> / </span>{numeral(surah.surah.no)}</p>
      <h1>{surah.surah.name}</h1>
      <fieldset className="depth-switch">
        <legend>{ui.reader.choose_depth}</legend>
        <div className="depth-options">
          {ui.levels.map((item) => <label key={item.depth} className={depth === item.depth ? "depth-option is-selected" : "depth-option"}>
            <input type="radio" name="depth" value={item.depth} checked={depth === item.depth} onChange={() => {
              setDepth(item.depth); setSelected(null); remember(item.depth); updateUrl(item.depth, true);
            }} />
            <span>{item.name}</span>
          </label>)}
        </div>
      </fieldset>
    </header>
    <article className="reading-body" aria-label={ui.levels.find((item) => item.depth === depth)!.name}>
      {level.blocks.length ? level.blocks.map((block, i) => <ContentBlock key={`${depth}-${i}`} block={block} ayahs={ayahs} records={surah.records} ui={ui} onOpen={setSelected} />) : <p>{ui.reader.empty_level}</p>}
    </article>
    {selected ? <SourcePanel records={selected} ui={ui} onClose={closePanel} /> : null}
  </>;
}
