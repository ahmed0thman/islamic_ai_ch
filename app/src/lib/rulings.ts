import type { BadgeKey, IconKey, Ruling } from "./types";

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

/** How firmly a record stands, firmest first: an authenticated record, one with no badge, a considered disagreement, one that is not established. */
const certaintyRank: Record<BadgeKey | "none", number> = { thabit: 0, none: 1, khilaf_mutabar: 2, la_yathbut: 3 };
const rankOf = (record: { badge: BadgeKey | null }) => certaintyRank[record.badge ?? "none"];
type Ranked = { badge: BadgeKey | null; icons: IconKey[] };
/** Where a record's earliest kind stands in the legend order; this is what breaks a tie between records of equal rank. */
const kindRank = (record: Ranked, order: readonly IconKey[]) => Math.min(...record.icons.map((kind) => order.indexOf(kind)).filter((position) => position >= 0), order.length);
/** Firmest first; equal rank by the legend's kind order; anything still equal keeps its place (stable). Returns a new array. */
export function sortByCertainty<T extends Ranked>(records: readonly T[], order: readonly IconKey[]): T[] {
  return records.map((record, index) => ({ record, index })).sort((a, b) =>
    rankOf(a.record) - rankOf(b.record) || kindRank(a.record, order) - kindRank(b.record, order) || a.index - b.index).map((entry) => entry.record);
}
/** The kinds a group of records carries, in the order of the records: the firmest record's kinds come first. */
export function kindsByCertainty(records: readonly Ranked[], order: readonly IconKey[]): IconKey[] {
  return [...new Set(sortByCertainty(records, order).flatMap((record) => order.filter((kind) => record.icons.includes(kind))))];
}
/** The qualifications that are shown as badges, firmest first, each once. Takes the badges themselves, so a door that only carries its title's badges can use it. */
export function badgesByCertainty(badges: readonly (BadgeKey | null)[]): ("khilaf_mutabar" | "la_yathbut")[] {
  return (["khilaf_mutabar", "la_yathbut"] as const).filter((kind) => badges.includes(kind));
}
