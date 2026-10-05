/** Empty gold is unscorable, never a perfect retrieval. Duplicate hits count once. */
export function recallAt(ids: readonly string[], gold: readonly string[], k: number): number | null {
  const wanted = new Set(gold);
  if (!wanted.size) return null;
  const found = new Set(ids.slice(0, k));
  return [...wanted].filter((id) => found.has(id)).length / wanted.size;
}

export function reciprocalRankAt(ids: readonly string[], gold: readonly string[], k = 10): number | null {
  if (!gold.length) return null;
  const wanted = new Set(gold);
  const rank = ids.slice(0, k).findIndex((id) => wanted.has(id));
  return rank < 0 ? 0 : 1 / (rank + 1);
}

/** Linear interpolation, including the conventional median for even-sized samples. */
export function percentile(values: readonly number[], quantile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export const mean = (values: readonly number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
