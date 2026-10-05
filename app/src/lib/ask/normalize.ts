/**
 * `normalizeSearch` is the retrieval store's normalisation. It must stay identical to `normalize()` in tools/retrieve.py;
 * tools/data/normalize-cases.json is read by both test suites to keep them equal.
 * `normalize` below is the answer guard's (Quran detection, quotation and attribution checks); it pairs with the generated
 * quran-plain.json (scripts/sync-content.mjs) and is deliberately left as it was. Unifying the two is a separate, owner-visible change.
 */
// Combining marks, Quranic annotation signs, tatweel and the byte-order mark (the same ranges as the pipeline's `_MARKS`).
const MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0898-\u089f\u08ca-\u08ff\u0640\ufeff]/gu;
const FOLD: Record<string, string> = {
  "\u0622": "\u0627", "\u0623": "\u0627", "\u0625": "\u0627", "\u0671": "\u0627",
  "\u0624": "\u0648", "\u0626": "\u064a", "\u0621": "", "\u0649": "\u064a", "\u0629": "\u0647",
};

export function normalizeSearch(text: string): string {
  return text.replace(MARKS, "").replace(/[\u0622\u0623\u0625\u0671\u0624\u0626\u0621\u0649\u0629]/gu, (char) => FOLD[char])
    .split(/\s+/u).filter(Boolean).join(" ");
}

export function normalize(text: string): string {
  return text.replace(/[\u0622\u0623\u0625\u0671\u0621\u0624\u0626]/gu, "\u0627").normalize("NFD")
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
    .replace(/[\u0622\u0623\u0625\u0671\u0621\u0624\u0626]/gu, "\u0627")
    .replace(/\u0649/gu, "\u064a")
    .replace(/\u0629/gu, "\u0647")
    .toLowerCase();
}

export function lexicalScore(question: string, text: string): number {
  const words = new Set(normalize(question).match(/[\p{L}\p{N}]+/gu) ?? []);
  return [...new Set(normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [])]
    .reduce((score, word) => score + Number(words.has(word)), 0);
}
