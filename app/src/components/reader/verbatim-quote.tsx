import type { ReactNode } from "react";
import { splitLastWord } from "@/lib/reading-text";

export type VerbatimQuoteProps = { text: string; marker?: ReactNode; record?: string };
export function VerbatimQuote({ text, marker, record }: VerbatimQuoteProps) {
  const [start, end] = splitLastWord(text);
  return <q className="verbatim-quote" data-record={record}>{start}<span className="claim-ending">{end}{marker}</span></q>;
}
