import type { Ruling } from "./types";

/**
 * A ruling's `where` is "source | locus | position | json". The locus says where the statement sits:
 * the author's text, a footnote, a platform's grade field, or the book's own condition ("he reported it in his
 * Sahih", a title). Only the first three are an explicit ruling by a named ruler; a book condition is takhrij.
 * Anything this does not recognise is takhrij too, so nothing is shown as a ruling without the record saying so.
 */
const rulingLoci = new Set(["matn", "footnote", "platform_grade"]);
export function rulingLocus(ruling: Ruling): string {
  return ruling.where.split("|")[1]?.trim() ?? "";
}
export function isExplicitRuling(ruling: Ruling): boolean {
  return rulingLoci.has(rulingLocus(ruling));
}
export function splitRulings(rulings: Ruling[]): { rulings: Ruling[]; takhrij: Ruling[] } {
  return { rulings: rulings.filter(isExplicitRuling), takhrij: rulings.filter((ruling) => !isExplicitRuling(ruling)) };
}
