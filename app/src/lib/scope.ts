import type { Passage, Surah } from "./types";

export type Scope = { kind: "surah" } | { kind: "passage"; id: string } | { kind: "range"; from: number; to: number } | { kind: "ayah"; key: string };
export function scopeContains(key: string, scope: Scope, passages: Passage[] = []): boolean {
  if (scope.kind === "surah") return true;
  if (scope.kind === "ayah") return scope.key === key;
  const number = Number(key.split(":")[1]);
  if (scope.kind === "range") return number >= scope.from && number <= scope.to;
  const passage = passages.find((item) => item.id === scope.id);
  return Boolean(passage && number >= Number(passage.from.split(":")[1]) && number <= Number(passage.to.split(":")[1]));
}
export function scopeStart(surah: Surah, scope: Scope): string {
  if (scope.kind === "ayah") return scope.key;
  if (scope.kind === "range") return `${surah.surah.no}:${scope.from}`;
  if (scope.kind === "passage") return surah.passages?.find((item) => item.id === scope.id)?.from ?? `${surah.surah.no}:1`;
  return `${surah.surah.no}:1`;
}
