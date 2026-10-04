"use client";

import type { SourceRecord, Ui } from "@/lib/types";
import type { SourceOptions } from "./sheet-provider";

export type TermLinkProps = { term: string; record: SourceRecord; ui: Ui; onOpen: (records: SourceRecord[], options?: SourceOptions) => void };
export function TermLink({ term, record, ui, onOpen }: TermLinkProps) {
  return <button className="term-link" type="button" aria-haspopup="dialog" aria-label={`${ui.reader.open_term}: ${term}`} onClick={(event) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onOpen([record], { term });
  }}>{term}</button>;
}
