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
