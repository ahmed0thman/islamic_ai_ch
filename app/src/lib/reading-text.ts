/** Keep the existing Complex-file end-glyph rule; never change an ayah's words. */
export const ayahWords = (text: string) => text.replace(/[\s\u00a0]*[\ufb50-\ufdcf]+$/u, "");
export function splitLastWord(text: string): [string, string] {
  const tail = text.match(/\S+\s*$/u)?.[0] ?? text;
  return [text.slice(0, text.length - tail.length), tail];
}
