"use client";

import type { PublicAtom } from "@/lib/ask/types";
import { sourceRecordOf } from "@/lib/ask-client";
import type { ReadingProps } from "./reading-context";
import { SourceMarker } from "./source-marker";
import { VerbatimQuote } from "./verbatim-quote";

/** A book excerpt as the reader sees it: its words verbatim, the marker that opens where they come from, and the title of the book. */
export function SourceAtomRow({ atom, ui, onOpen }: { atom: PublicAtom } & Pick<ReadingProps, "ui" | "onOpen">) {
  const record = sourceRecordOf(atom);
  const text = atom.segments.map((segment) => segment.t === "text" ? segment.v : "").join("");
  return <div className="ask-source">
    <p className="claim-text"><VerbatimQuote text={text} marker={record ? <SourceMarker records={[record]} ui={ui} onOpen={() => onOpen([record])} /> : undefined} /></p>
    {atom.source ? <p className="ask-source-title">{atom.source.title}</p> : null}
  </div>;
}
