"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Ayah, Block, Depth, Segment, SourceRecord, Surah, Ui } from "@/lib/types";
import { Marker } from "./marks";
import { SourcePanel } from "./source-panel";
import { numeral } from "@/lib/numerals";

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
// The Complex file ends each ayah with a number glyph that only its own font draws;
// the number is shown separately, so the trailing glyph is dropped. The ayah's words are untouched.
const ayahWords = (text: string) => text.replace(/[\s\u00a0]*[\ufb50-\ufdcf]+$/u, "");
// Split only at the last word so a marker never forces a whole claim onto one line.
function splitLastWord(text: string): [string, string] {
  const tail = text.match(/\S+\s*$/u)?.[0] ?? text;
  return [text.slice(0, text.length - tail.length), tail];
}
function AyahText({ ayah, inline = false, part = "whole" }: { ayah: Ayah; inline?: boolean; part?: "whole" | "start" | "end" }) {
  const words = ayahWords(ayah.text);
  const [start, end] = splitLastWord(words);
  return <span className={inline ? "quran inline-ayah" : "quran ayah-text"}>
    <span>{part === "whole" ? words : part === "start" ? start : end}</span>
    {part !== "start" ? <>{"\u00a0"}<span className="ayah-number">{numeral(ayah.no)}</span></> : null}
  </span>;
}
type ReadingProps = {
  ayahs: Map<string, Ayah>; records: Surah["records"]; ui: Ui; onOpen: (records: SourceRecord[]) => void;
};
export function ContentBlock({ block, ...props }: ReadingProps & { block: Block }) {
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
  return block.title ? <><h2 className="reading-heading reading-question">{block.title}</h2>{paragraph}</> : paragraph;
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
      {level.blocks.length ? level.blocks.map((block, i) => {
        // A question heading already asks what the stop under it is titled; show it once.
        const above = level.blocks[i - 1];
        const repeated = block.type === "paragraph" && block.title && above?.type === "heading" && above.text === block.title;
        return <ContentBlock key={`${depth}-${i}`} block={repeated ? { ...block, title: undefined } : block} ayahs={ayahs} records={surah.records} ui={ui} onOpen={setSelected} />;
      }) : <p>{ui.reader.empty_level}</p>}
    </article>
    {selected ? <SourcePanel records={selected} ui={ui} onClose={closePanel} /> : null}
  </>;
}
