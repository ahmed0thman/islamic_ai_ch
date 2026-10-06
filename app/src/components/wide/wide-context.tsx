"use client";

import { useMemo } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Depth, Surah } from "@/lib/types";
import type { SceneUnit } from "@/lib/depth-items";
import { passageRecords } from "@/lib/wide-index";
import { deriveTermsSummary } from "@/lib/terms-summary";
import { numeral } from "@/lib/numerals";
import { useReading } from "@/components/reader/reading-context";
import { SourceChip } from "@/components/ui/source-chip";
import { Icon } from "@/components/ui/icon";
import { TermsSummary } from "@/components/reader/terms-summary";
import { WeaveCard } from "@/components/reader/weave-card";
import { useWideSurface, type WideTab } from "./wide-surface";
import { useSavedQuestions } from "./use-saved-questions";

export function WideContext({ tab, surah, depth, stop, ayah, closing }: { tab: WideTab; surah: Surah; depth: Depth; stop?: SceneUnit; ayah: string | null; closing: boolean }) {
  const { ui, onOpen } = useReading();
  const surface = useWideSurface();
  const passage = closing ? undefined : surah.passages?.find((item) => item.id === stop?.passage || !stop && ayah && Number(ayah.split(":")[1]) >= Number(item.from.split(":")[1]) && Number(ayah.split(":")[1]) <= Number(item.to.split(":")[1])) ?? (!stop ? surah.passages?.[0] : undefined);
  const keys = passage ? surah.ayahs.filter((item) => item.key.startsWith(`${surah.surah.no}:`) && item.no >= Number(passage.from.split(":")[1]) && item.no <= Number(passage.to.split(":")[1])).map((item) => item.key) : surah.ayahs.filter((item) => item.key.startsWith(`${surah.surah.no}:`)).map((item) => item.key);
  const records = passageRecords(surah, depth, keys);
  const books = new Map<string, typeof records>();
  for (const record of records) for (const evidence of record.evidence) if (evidence.source_title) {
    const list = books.get(evidence.source_title) ?? [];
    if (!list.includes(record)) list.push(record);
    books.set(evidence.source_title, list);
  }
  const terms = useMemo(() => deriveTermsSummary(surah.levels.find((item) => item.depth === depth)?.blocks ?? [], surah.records, ui.sciences), [surah, depth, ui.sciences]);
  if (tab === "weave") return <WideWeaveContext surahNo={surah.surah.no} depth={depth} stop={stop} />;
  if (tab === "term") return <div className="wide-context-content"><h2>{ui.wide.tab_term}</h2><p className="wide-hint">{ui.wide.term_hint}</p>{terms ? <TermsSummary summary={terms} ui={ui} onOpen={onOpen} /> : null}</div>;
  if (tab === "source") return <div className="wide-context-content"><h2>{ui.wide.tab_source}</h2><p className="wide-hint">{ui.wide.source_hint}</p>{bookList()}</div>;
  return <div className="wide-context-content"><p className="sheet-label">{passage ? <>{ui.reader.passages_title} · <bdi dir="ltr">{numeral(surah.passages!.indexOf(passage) + 1)} / {numeral(surah.passages!.length)}</bdi></> : ui.levels.find((item) => item.depth === depth)?.name}</p><h2>{closing ? ui.summary.title : passage?.title ?? surah.surah.name}</h2>
    {passage ? <p className="wide-hint">{ui.reader.ayahs_title} <bdi dir="ltr">{numeral(Number(passage.from.split(":")[1]))}–{numeral(Number(passage.to.split(":")[1]))}</bdi></p> : null}
    <h3>{ui.legend.icons_title}</h3><ul className="wide-types">{ui.icon_order.filter((kind) => records.some((record) => record.icons.includes(kind))).map((kind) => <li key={kind}><SourceChip kind={kind} ui={ui} size="small" />{ui.icons[kind].label}<b>{numeral(records.filter((record) => record.icons.includes(kind)).length)}</b></li>)}</ul>
    {bookList()}
  </div>;
  function bookList() {
    return books.size ? <section><h3 className="wide-sources-heading">{ui.wide.passage_sources}{tab === "passage" ? <button type="button" className="wide-link" onClick={() => { surface?.closeDetail(); surface?.selectTab("source"); }}>{ui.wide.all_sources}</button> : null}</h3><div className="wide-book-list">{Array.from(books).map(([title, list]) => {
      const evidence = list.flatMap((record) => record.evidence.filter((item) => item.source_title === title));
      const authors = [...new Set(evidence.map((item) => item.author).filter(Boolean))];
      return <button type="button" key={title} onClick={() => onOpen(list)}><SourceChip kind={evidence[0].icon} ui={ui} size="small" /><span>{title}{authors.length === 1 ? <small>{authors[0]}</small> : null}</span><b>{numeral(list.length)}</b><Icon icon={ArrowLeft01Icon} size={16} /></button>;
    })}</div></section> : null;
  }
}
function WideWeaveContext({ surahNo, depth, stop }: { surahNo: number; depth: Depth; stop?: SceneUnit }) {
  const { ui } = useReading();
  const questions = useSavedQuestions(surahNo);
  return <div className="wide-context-content"><h2>{stop?.sceneTitle ?? stop?.title ?? ui.wide.tab_weave}</h2>
    {stop && questions.length ? <WeaveCard key={`${surahNo}:${depth}:${stop.number}`} surah={surahNo} depth={depth} stop={stop.number} questions={questions} onBack={() => document.querySelector<HTMLElement>(".wide-reading [data-scene-heading]")?.focus({ preventScroll: true })} /> : <p className="wide-hint">{ui.wide.weave_empty}</p>}
  </div>;
}
