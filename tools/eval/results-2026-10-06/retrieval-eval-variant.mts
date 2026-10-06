// Retrieval only: inherited environment, no dotenv, no provider calls, no atom texts.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { retrieveAtoms } from "../../../app/src/lib/rag/retrieve.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { getPool } from "../../../app/src/lib/rag/db.ts";
// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { mean, percentile, recallAt, reciprocalRankAt } from "../../../app/src/lib/rag/eval-metrics.ts";

type Mode = "lexical" | "semantic" | "hybrid";
interface Case {
  id: string; split: "dev" | "held"; question?: string; ref?: string;
  surah: number; depth: 0 | 1 | 2 | 3; gold_atoms: string[];
  title_is_gold?: boolean; needs_history?: boolean;
}
interface Result {
  id: string; split: string; mode: Mode; effective_mode: string;
  top_ids: string[]; latency_ms: number; semantic_unavailable: boolean;
  retrieval_unavailable: boolean; title_is_gold: boolean; exclusion: string | null;
  recall: Record<string, number | null>; mrr_at_10: number | null;
}
const root = process.env.HUDA_ROOT ?? "<repo-root>";

async function main() {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  let markdown = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--md") { markdown = true; continue; }
    if (!["--split", "--mode", "--k", "--out"].includes(flag) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("invalid arguments");
    }
    if (options.has(flag)) throw new Error("duplicate option");
    options.set(flag, args[++i]);
  }
  const split = options.get("--split") ?? "held";
  const mode = options.get("--mode") ?? "all";
  if (!["dev", "held", "all"].includes(split) || !["lexical", "semantic", "hybrid", "all"].includes(mode)) throw new Error("invalid split or mode");
  const requestedK = (options.get("--k") ?? "8,24").split(",").map(Number);
  if (!requestedK.length || requestedK.some((k) => !Number.isInteger(k) || k < 1 || k > 60)) throw new Error("k must contain integers from 1 to 60");
  // The required metrics are always included; --k may request additional cutoffs.
  const ks = [...new Set([8, 24, ...requestedK])].sort((a, b) => a - b);
  const modes: Mode[] = mode === "all" ? ["lexical", "semantic", "hybrid"] : [mode as Mode];
  const out = path.resolve(options.get("--out") ?? path.join(root, "tools/data/eval/results", `retrieval-${new Date().toISOString().slice(0, 10)}.json`));
  const mdOut = out.endsWith(".json") ? out.slice(0, -5) + ".md" : out + ".md";
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set; retrieval evaluation pending");
  const dataset = JSON.parse(await readFile(process.env.CASES_FILE!, "utf8")) as { cases: Case[] };
  const safety = JSON.parse(await readFile(path.join(root, "tools/data/eval/safety_cases.json"), "utf8")) as { cases: { id: string; question: string }[] };
  const questions = new Map(safety.cases.map((item) => [item.id, item.question]));
  const cases = dataset.cases.filter((item) => split === "all" || item.split === split);
  const perCase: Result[] = [];
  try {
    for (const requestedMode of modes) for (const item of cases) {
      const question = item.question ?? (item.ref ? questions.get(item.ref) : undefined);
      if (!question) throw new Error(`missing question for ${item.id}`);
      const started = performance.now();
      // No stop/history injection: score rank winners, not context atoms added by the SQL.
      const result = await retrieveAtoms({ question, surah: item.surah, depth: item.depth, k: Math.max(10, ...ks), mode: requestedMode }, async () => []);
      const retrievalUnavailable = result.mode === "fallback";
      const semanticUnavailable = requestedMode !== "lexical" && !retrievalUnavailable && (result.mode === "lexical" || result.candidates.dense === 0);
      const exclusion = item.needs_history ? "needs_history" : !item.gold_atoms.length ? "no_gold" : retrievalUnavailable ? "retrieval unavailable" : requestedMode === "semantic" && semanticUnavailable ? "semantic unavailable" : null;
      perCase.push({
        id: item.id, split: item.split, mode: requestedMode, effective_mode: result.mode,
        top_ids: result.top, latency_ms: performance.now() - started,
        semantic_unavailable: semanticUnavailable, retrieval_unavailable: retrievalUnavailable,
        title_is_gold: item.title_is_gold === true, exclusion,
        recall: Object.fromEntries(ks.map((k) => [`recall_at_${k}`, exclusion ? null : recallAt(result.top, item.gold_atoms, k)])),
        mrr_at_10: exclusion ? null : reciprocalRankAt(result.top, item.gold_atoms, 10),
      });
    }
  } finally { await getPool()?.end(); }

  const summarize = (rows: Result[]) => {
    const scored = rows.filter((row) => !row.exclusion);
    const timed = rows.filter((row) => !row.retrieval_unavailable && !(row.mode === "semantic" && row.semantic_unavailable));
    return {
      n: scored.length, attempted: rows.length, latency_n: timed.length,
      ...Object.fromEntries(ks.map((k) => [`recall_at_${k}`, mean(scored.map((row) => row.recall[`recall_at_${k}`]!))])),
      mrr_at_10: mean(scored.map((row) => row.mrr_at_10!)),
      p50_ms: percentile(timed.map((row) => row.latency_ms), 0.5),
      p95_ms: percentile(timed.map((row) => row.latency_ms), 0.95),
      semantic_unavailable: rows.filter((row) => row.semantic_unavailable).length,
      retrieval_unavailable: rows.filter((row) => row.retrieval_unavailable).length,
    };
  };
  const summaries = Object.fromEntries(modes.map((name) => {
    const rows = perCase.filter((row) => row.mode === name);
    return [name, { ...summarize(rows.filter((row) => !row.title_is_gold)),
      title_is_gold: summarize(rows.filter((row) => row.title_is_gold)),
      attempted_total: rows.length,
      semantic_unavailable_total: rows.filter((row) => row.semantic_unavailable).length,
      retrieval_unavailable_total: rows.filter((row) => row.retrieval_unavailable).length,
    }];
  }));
  const report = {
    built_at: new Date().toISOString(), split,
    counts: { dataset: dataset.cases.length, selected: cases.length, dev: cases.filter((item) => item.split === "dev").length, held: cases.filter((item) => item.split === "held").length,
      no_gold: cases.filter((item) => !item.gold_atoms.length).length, needs_history: cases.filter((item) => item.needs_history).length, title_is_gold: cases.filter((item) => item.title_is_gold).length },
    notes: ["Only held-out results may be announced.", "Primary scores exclude title_is_gold, needs_history and empty gold; title_is_gold scores are separate.", "Macro recall uses gold_atoms only. Context-only atoms are excluded from ranking.", "Semantic fallback is unavailable, never a semantic score. Hybrid degradation is counted explicitly.", "Latency includes embedding warm-up and uses successful retrievals; semantic fallback is excluded.", "The set favours easier, standalone titles. Recall is a lower bound when equivalent atoms exist in other depths.", "These numbers measure retrieval, not religious correctness."],
    modes: summaries, per_case: perCase,
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  if (markdown) {
    const fmt = (value: number | null) => value === null ? "unavailable" : value.toFixed(4);
    const table = (title: boolean) => ["| mode | recall@8 | recall@24 | MRR@10 | p50 (ms) | p95 (ms) | n |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |", ...modes.map((name) => {
      const entry = summaries[name];
      const value = title ? entry.title_is_gold : entry;
      return `| ${name} | ${fmt(value.recall_at_8)} | ${fmt(value.recall_at_24)} | ${fmt(value.mrr_at_10)} | ${fmt(value.p50_ms)} | ${fmt(value.p95_ms)} | ${value.n} |`;
    })].join("\n");
    await writeFile(mdOut, `# Retrieval evaluation (${split})\n\n${report.notes.join("\n\n")}\n\n${table(false)}\n\n## Title is gold (separate)\n\n${table(true)}\n\n` + modes.map((name) => `${name}: semantic unavailable=${summaries[name].semantic_unavailable_total}; retrieval unavailable=${summaries[name].retrieval_unavailable_total}; attempted=${summaries[name].attempted_total}.`).join("\n\n") + "\n");
  }
  console.log(JSON.stringify({ split, counts: report.counts, modes: summaries }));
  if (perCase.some((row) => row.retrieval_unavailable)) process.exitCode = 1;
}

main().catch(() => {
  // Do not leak database errors, credentials or question/atom text.
  console.error("Retrieval evaluation failed: check arguments, inherited DATABASE_URL and local retrieval store; no result is announced.");
  process.exitCode = 1;
});
