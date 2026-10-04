import type { Segment } from "./types";

const opening = /\s*«\s*$/u;
const closing = /^\s*»\s*/u;
const trailing = /^[،,.؛:!؟…]+/u;
/**
 * A verbatim quote is drawn as its own block, so the « before it and the » after it would hang outside the block.
 * For display only: drop the « that ends the text right before a quote and the » that opens the text right after it
 * (marks may sit between), and carry the punctuation that followed » onto the quote as `trail`, so no line starts with a comma.
 * Content, the quote's own text and its marks are untouched; the input is not mutated.
 */
export function tidyQuoteMarks(segments: Segment[]): Segment[] {
  const out: Segment[] = segments.map((segment) => ({ ...segment }));
  out.forEach((segment, index) => {
    if (segment.t !== "quote") return;
    const before = out[index - 1];
    if (before?.t === "text" && opening.test(before.v)) before.v = before.v.replace(opening, "");
    let next = index + 1;
    while (out[next]?.t === "mark") next++;
    const after = out[next];
    if (after?.t !== "text" || !closing.test(after.v)) return;
    let rest = after.v.replace(closing, "");
    const punctuation = rest.match(trailing)?.[0];
    if (punctuation) { segment.trail = punctuation; rest = rest.slice(punctuation.length).trimStart(); }
    after.v = rest;
  });
  return out.filter((segment) => segment.t !== "text" || segment.v !== "");
}
