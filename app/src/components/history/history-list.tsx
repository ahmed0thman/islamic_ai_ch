"use client";

import { useEffect, useState } from "react";
import mushafData from "@/content/mushaf-index.json";
import type { MushafIndex } from "@/lib/mushaf";
import type { Ui } from "@/lib/types";
import { getHistory } from "@/lib/history/client";
import { historyRows, type HistoryRow } from "@/lib/history/rules";
import { fillSlots, formatDate } from "@/lib/history/format";
import { numeral } from "@/lib/numerals";

const mushaf = mushafData as unknown as MushafIndex;
const surahName = (no: number) => mushaf.surahs.find((item) => item.no === no)?.name;

type Loaded = { kind: "loading" } | { kind: "signedOut" } | { kind: "empty" } | { kind: "rows"; rows: HistoryRow[] } | { kind: "failed" };

/**
 * What the account holds across surahs, in the menu drawer (phone) and the account area (wide).
 * Signed out, one quiet line beside the sign-in entry; a failure shows nothing at all.
 */
export function HistoryList({ ui }: { ui: Ui }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    void getHistory().then((result) => {
      if (!alive) return;
      if (!result) setLoaded({ kind: "signedOut" });
      else if (!result.ok) setLoaded({ kind: "failed" });
      else if (!result.data.signedIn) setLoaded({ kind: "signedOut" });
      else {
        const rows = historyRows(result.data);
        setLoaded(rows.length ? { kind: "rows", rows } : { kind: "empty" });
      }
    });
    return () => { alive = false; };
  }, []);

  if (loaded.kind === "loading" || loaded.kind === "failed") return null;
  if (loaded.kind === "signedOut") return <p className="history-note">{ui.history.signed_out}</p>;
  if (loaded.kind === "empty") return <p className="history-note">{ui.history.empty}</p>;
  return <ul className="history-rows">{loaded.rows.map((row) => {
    const name = surahName(row.surah);
    if (!name) return null;
    const depthName = ui.levels.find((level) => level.depth === row.depth)?.name ?? "";
    return <li className="history-row" key={row.surah}>
      <p className="history-row-name">{name}</p>
      {row.visited > 0 ? <p className="history-row-line">{fillSlots(ui.history.row_progress, { visited: numeral(row.visited), total: numeral(row.visited), depth: depthName })}</p> : null}
      {row.questions > 0 ? <p className="history-row-line">{fillSlots(ui.history.row_questions, { count: numeral(row.questions) })}</p> : null}
      {row.lastSeen > 0 ? <p className="history-row-line">{fillSlots(ui.history.last_seen, { date: formatDate(row.lastSeen) })}</p> : null}
      <a className="history-row-open" href={`/s/${row.surah}/?d=${row.depth}${row.stop === null ? "" : `&stop=${row.stop}`}`}>{ui.history.open_surah}</a>
    </li>;
  })}</ul>;
}
