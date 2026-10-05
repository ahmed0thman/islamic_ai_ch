// @ts-expect-error -- Node requires source extensions.
import { compose } from "./compose.ts";
// @ts-expect-error -- Node requires source extensions.
import { verify, parseComposition } from "./verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { filterSupported, supportRequest } from "./support.ts";
// @ts-expect-error -- Node requires source extensions.
import { buildPrompt, SYSTEM_PROMPT, CHOICE_SCHEMA, validateChoice } from "./select.ts";
// @ts-expect-error -- Node requires source extensions.
import { runStage } from "./runtime.ts";
import type { Observer, StageEvent } from "./runtime";
import type { AskResponse, Atom, ChoiceProvider, ReaderContext } from "./types";

export interface AnswerOptions {
  mode?: "composed" | "extractive";
  support?: boolean;
  /** Override stage budgets for tests; their sum is always bounded by 25 seconds. */
  timeouts?: { compose: number; support: number; select: number };
  observe?: Observer;
  log?: (line: string) => void;
}
export async function answer(question: string, atoms: Atom[], context: ReaderContext | undefined, providers: ChoiceProvider | ChoiceProvider[], options: AnswerOptions = {}): Promise<AskResponse> {
  const start = Date.now(), deadline = start + 40_000;
  const events: StageEvent[] = [];
  const observe: Observer = (event) => { events.push(event); options.observe?.(event); };
  const note = (stage: string, outcome: string) => observe({ stage, provider: "server", outcome, ms: 0 });
  const chain = Array.isArray(providers) ? providers : [providers];
  // Each stage's budget is shared by the providers in the chain; measured live, one written answer takes 3 to 6 s.
  const budgets = options.timeouts || { compose: 18_000, support: 12_000, select: 8_000 };
  const stage = (request: Parameters<typeof runStage>[0], ms: number) => runStage(request, chain, Math.max(0, Math.min(ms, deadline - Date.now())), observe);
  try {
    if ((options.mode || process.env.HUDA_ASK_MODE) !== "extractive") {
      try {
        const prompt = compose(question, atoms, context);
        const value = await stage(prompt.request, budgets.compose);
        // Fixed statuses do not need Quran indexing, mechanical checks, or support.
        const parsed = parseComposition(value, prompt.atoms);
        if (parsed && parsed.status !== "answer") { note("compose", parsed.status); return { status: parsed.status, atoms: [] }; }
        const checked = verify(value, prompt.atoms, context);
        if (!checked.ok) { note("verify", checked.reason); throw new Error("verification_failed"); }
        note("verify", "ok");
        let sentences = checked.value.sentences;
        if (options.support ?? process.env.HUDA_ASK_SUPPORT !== "0") {
          const verdicts = await stage(supportRequest(sentences, prompt.atoms), budgets.support);
          let filtered;
          try { filtered = filterSupported(verdicts, sentences); }
          catch { note("support", "support_shape"); throw new Error("support_shape"); }
          note("support", filtered.length ? filtered.length === sentences.length ? "supported" : "filtered" : "unsupported");
          sentences = filtered;
        }
        if (!sentences.length) throw new Error("no_supported_sentences");
        const ids = new Set(sentences.flatMap((sentence) => sentence.cites));
        return { status: "answer", mode: "composed", composed: sentences.map(({ text, cites }) => ({ text, atom_ids: cites })),
          atoms: prompt.atoms.filter((atom) => ids.has(atom.id)).map(({ id, level, role, segments, records }) => ({ id, level, role, segments, records })) };
      } catch { note("fallback", "extractive"); }
    }
    try {
      const prompt = buildPrompt(question, atoms, 100_000, context);
      const value = await stage({ system: SYSTEM_PROMPT, message: prompt.message, schema: CHOICE_SCHEMA, stage: "select" }, budgets.select);
      const result = validateChoice(value, prompt.atoms);
      note("select", result.status);
      return result.status === "answer" ? { ...result, mode: "extractive" } : result;
    } catch { note("fallback", "insufficient"); return { status: "insufficient", atoms: [] }; }
  } finally {
    // One structured line per request; only fixed codes, names and elapsed times.
    (options.log || console.info)(JSON.stringify({ event: "ask", stages: events, ms: Date.now() - start }));
  }
}
