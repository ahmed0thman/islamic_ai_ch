// @ts-expect-error -- Node requires source extensions.
import { compose } from "./compose.ts";
// @ts-expect-error -- Node requires source extensions.
import { verify, parseComposition } from "./verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { supportVerdicts, supportRequest } from "./support.ts";
// @ts-expect-error -- Node requires source extensions.
import { buildPrompt, SYSTEM_PROMPT, CHOICE_SCHEMA, validateChoice } from "./select.ts";
// @ts-expect-error -- Node requires source extensions.
import { runStage } from "./runtime.ts";
import type { Observer, StageEvent } from "./runtime";
import type { AskResponse, Atom, ComposedItem, ChoiceProvider, ReaderContext } from "./types";

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
        const sentences = checked.value.sentences;
        let flags = sentences.map(() => true);
        if (options.support ?? process.env.HUDA_ASK_SUPPORT !== "0") {
          const verdicts = await stage(supportRequest(sentences, prompt.atoms), budgets.support);
          try { flags = supportVerdicts(verdicts, sentences); }
          catch { note("support", "support_shape"); throw new Error("support_shape"); }
          const kept = flags.filter(Boolean).length;
          note("support", kept === sentences.length ? "supported" : kept ? "partial" : "unsupported");
        }
        if (!flags.some(Boolean)) throw new Error("no_supported_sentences");
        // Keep the written order; a dropped sentence keeps its cites so the UI can show them verbatim.
        const composed: ComposedItem[] = [];
        sentences.forEach(({ text, cites }, index) => {
          if (flags[index]) { composed.push({ text, atom_ids: cites }); return; }
          const last = composed.at(-1);
          if (last && last.text === undefined && last.atom_ids.length === cites.length && last.atom_ids.every((id) => cites.includes(id))) return;
          composed.push({ atom_ids: cites });
        });
        // Every atom any item cites, each once, in first-use order.
        const byId = new Map(prompt.atoms.map((atom) => [atom.id, atom]));
        const used = [...new Set(composed.flatMap((item) => item.atom_ids))].map((id) => byId.get(id)!);
        return { status: "answer", mode: "composed", composed,
          atoms: used.map(({ id, level, role, segments, records }) => ({ id, level, role, segments, records })) };
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
