import type { ReactNode } from "react";
import { splitLastWord } from "@/lib/reading-text";

export type VerbatimQuoteProps = { text: string; marker?: ReactNode; record?: string; trail?: string };
export function VerbatimQuote({ text, marker, record, trail }: VerbatimQuoteProps) {
  const [start, end] = splitLastWord(text);
  return <q className="verbatim-quote" data-record={record}>{start}<span className="claim-ending">{end}{trail}{marker}</span></q>;
}
