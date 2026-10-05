// @ts-expect-error -- Node requires source extensions.
import { compose, repairRequest, type RepairProblem } from "./compose.ts";
// @ts-expect-error -- Node requires source extensions.
import { verifyEach, parseComposition, type VerifyReason } from "./verify.ts";
// @ts-expect-error -- Node requires source extensions.
import { supportVerdicts, supportRequest } from "./support.ts";
// @ts-expect-error -- Node requires source extensions.
import { splitExamples, pickExample } from "./example.ts";
// @ts-expect-error -- Node requires source extensions.
import { buildPrompt, SYSTEM_PROMPT, CHOICE_SCHEMA, validateChoice } from "./select.ts";
// @ts-expect-error -- Node requires source extensions.
import { runStage } from "./runtime.ts";
// @ts-expect-error -- Node requires source extensions.
import { publicAtom } from "./public-atom.ts";
import type { Observer, StageEvent } from "./runtime";
import type { AskResponse, Atom, ComposedItem, ComposedSentence, ChoiceProvider, ExamplePair, HistoryTurn, ReaderContext } from "./types";

/** The whole request, from the first model call to the reply. */
export const REQUEST_DEADLINE_MS = 28_000;
/** The repair round runs only when fewer written sentences than this survived the first round (or all of them, when it wrote fewer). */
export const REPAIR_BELOW = 2;
export interface AnswerOptions {
  mode?: "composed" | "extractive";
  /** False for an optional re-weave beside an original that is already visible. Defaults to true. */
  extractiveFallback?: boolean;
  support?: boolean;
  /** Earlier turns of the conversation, already validated (see history.ts). Context for references only. */
  history?: readonly HistoryTurn[];
  /** Override stage budgets for tests; every stage is also bounded by the request deadline. `repair` defaults to the compose budget. */
  timeouts?: { compose: number; support: number; select: number; repair?: number };
  observe?: Observer;
  log?: (line: string) => void;
  /** Illustrations for the writer (a verified sentence and its source quote); never material. */
  examples?: readonly ExamplePair[];
  /** Stage events made before this call (the retrieval), written first in the request's log line. */
  preface?: readonly StageEvent[];
  /** Fixed-code counts to add to the log line (for example what the source-atom guard dropped). */
  logExtra?: Record<string, unknown>;
}

/** The written sentences of one answer, with what the two checks said about each, in the order written. */
interface Draft { sentences: ComposedSentence[]; claims: ComposedSentence[]; claimAt: number[]; flags: boolean[] }
const kept = (draft: Draft) => draft.flags.filter(Boolean).length;
const unique = <T,>(items: T[]) => [...new Set(items)];

export async function answer(question: string, atoms: Atom[], context: ReaderContext | undefined, providers: ChoiceProvider | ChoiceProvider[], options: AnswerOptions = {}): Promise<AskResponse> {
  const start = Date.now(), deadline = start + REQUEST_DEADLINE_MS;
  const events: StageEvent[] = [...(options.preface || [])];
  let cited: { verified: number; source: number; both: number } | undefined;
  const observe: Observer = (event) => { events.push(event); options.observe?.(event); };
  const note = (stage: string, outcome: string) => observe({ stage, provider: "server", outcome, ms: 0 });
  const chain = Array.isArray(providers) ? providers : [providers];
  const history = options.history || [];
  // Each stage's budget is shared by the providers in the chain; measured live, one written answer takes 3 to 6 s.
  // The first provider of a stage gets 80% of its budget (runtime.ts). A usual round measured live is compose 5.5 + support 4.3 + repair 4.1 + support 2.4 s, inside the one 28 s deadline;
  // when providers fail, the deadline cuts later stages short and the extractive choice always keeps its own `select` budget.
  const base = options.timeouts || { compose: 14_000, support: 12_000, select: 5_000, repair: 12_000 };
  const budgets = { ...base, repair: base.repair ?? base.compose };
  // A written answer never takes the time the fallback needs: the extractive choice keeps its own budget.
  const stage = (request: Parameters<typeof runStage>[0], ms: number, reserve = 0) => runStage(request, chain, Math.max(0, Math.min(ms, deadline - Date.now() - reserve)), observe);
  const useSupport = options.support ?? process.env.HUDA_ASK_SUPPORT !== "0";
  try {
    if ((options.mode || process.env.HUDA_ASK_MODE) !== "extractive") {
      try {
        const prompt = compose(question, atoms, context, history, options.examples || []);
        // A provider hiccup must not cost the reader the answer: one more try while there is time.
        let first: unknown;
        try { first = await stage(prompt.request, budgets.compose, budgets.select); }
        catch { note("compose", "retry"); first = await stage(prompt.request, budgets.compose, budgets.select); }
        // Fixed statuses do not need Quran indexing, mechanical checks, or support.
        const parsed = parseComposition(first, prompt.atoms);
        if (parsed && parsed.status !== "answer") { note("compose", parsed.status); return { status: parsed.status, atoms: [] }; }

        /** Support for the sentences allowed so far (`pass`): one flag per claim, false where it failed either check. */
        const supported = async (draft: Draft, pass: boolean[]): Promise<boolean[]> => {
          if (!useSupport || !pass.some(Boolean)) return pass;
          const subset = draft.claims.filter((_, i) => pass[i]);
          const verdicts = await stage(supportRequest(subset, prompt.atoms), budgets.support, budgets.select);
          let given: boolean[];
          try { given = supportVerdicts(verdicts, subset); }
          catch { note("support", "support_shape"); throw new Error("support_shape"); }
          let next = 0;
          return pass.map((ok) => ok && given[next++]);
        };
        /** Verify every written sentence on its own. `undefined` when the shape is wrong as a whole. */
        const draftOf = (value: unknown) => {
          const each = verifyEach(value, prompt.atoms, context);
          if (!each.ok) return undefined;
          const claimAt = each.value.sentences.flatMap((sentence, index) => sentence.kind === "example" ? [] : [index]);
          const claims = claimAt.map((index) => each.value.sentences[index]);
          return { draft: { sentences: each.value.sentences, claims, claimAt, flags: [] as boolean[] }, reasons: each.reasons };
        };

        let best: Draft | undefined;
        const problems: RepairProblem[] = [];
        const checked = draftOf(first);
        if (!checked) { note("verify", "shape"); problems.push({ index: 0, problem: "shape" }); }
        else {
          const { draft, reasons } = checked;
          const failed = reasons.filter((reason): reason is VerifyReason => reason !== undefined);
          note("verify", failed.length ? unique(failed).join(",") : "ok");
          reasons.forEach((reason, i) => { if (reason) problems.push({ index: draft.claimAt[i], problem: reason }); });
          // Support is checked for every sentence that passed the mechanical checks, so a slow or failed repair never costs the reader the sound ones.
          const pass = reasons.map((reason) => reason === undefined);
          if (pass.some(Boolean)) {
            draft.flags = await supported(draft, pass);
            const count = kept(draft);
            note("support", count === draft.claims.length ? "supported" : count ? "partial" : "unsupported");
            draft.flags.forEach((ok, i) => { if (pass[i] && !ok) problems.push({ index: draft.claimAt[i], problem: "unsupported" }); });
            best = draft;
          }
        }

        // Enough of the first answer stands: return it now rather than spend a second model round the reader waits for.
        const enough = best !== undefined && kept(best) >= Math.min(REPAIR_BELOW, best.claims.length);
        if (enough && problems.length) { note("repair", "skipped"); problems.length = 0; }

        // One repair round, and only one: the model gets its own answer back with what is wrong in each place.
        if (problems.length) {
          let outcome = "failed";
          try {
            const previous = (first as { sentences?: unknown } | null)?.sentences;
            const second = await stage(repairRequest(prompt.message, previous, problems), budgets.repair, budgets.select);
            const again = draftOf(second);
            if (again && parseComposition(second, prompt.atoms)?.status === "answer") {
              const { draft, reasons } = again;
              const pass = reasons.map((reason) => reason === undefined);
              draft.flags = await supported(draft, pass);
              if (kept(draft) && (!best || kept(draft) >= kept(best))) best = draft;
              outcome = kept(draft) === draft.claims.length ? "fixed" : kept(draft) ? "partial" : "failed";
            }
          } catch { /* A failed repair leaves what the first round could keep. */ }
          note("repair", outcome);
        }
        if (!best || !kept(best)) {
          if (options.extractiveFallback === false) { note("fallback", "disabled"); return { status: "insufficient", atoms: [] }; }
          // Nothing written stood, but the writer did point at sentences: show those as they are (verified sentences or book excerpts, word for word), with no further model call.
          const pointed = parsed?.status === "answer" ? unique(parsed.sentences.flatMap((sentence) => sentence.kind === "example" ? [] : sentence.cites)).slice(0, 4) : [];
          if (!pointed.length) throw new Error("no_supported_sentences");
          const byId = new Map(prompt.atoms.map((atom) => [atom.id, atom]));
          note("fallback", "cited_verbatim");
          return { status: "answer", mode: "extractive", atoms: pointed.map((id) => publicAtom(byId.get(id)!)) };
        }

        // Keep the written order; a dropped sentence keeps its cites so the UI can show them verbatim.
        const composed: ComposedItem[] = [];
        const writtenAt = new Map<number, number>();
        best.claims.forEach(({ text, cites }, index) => {
          if (best!.flags[index]) { writtenAt.set(index, composed.length); composed.push({ text, atom_ids: cites }); return; }
          const last = composed.at(-1);
          if (last && last.kind === undefined && last.text === undefined && last.atom_ids.length === cites.length && last.atom_ids.every((id) => cites.includes(id))) return;
          composed.push({ atom_ids: cites });
        });
        // The example, if any, once all the checks of an example pass; it comes right after the written sentence it follows (or after the first one).
        const { claims: _claims, examples } = splitExamples(best.sentences);
        if (examples.length) {
          const { example, reason } = pickExample(examples);
          if (example) {
            const before = [...writtenAt.keys()].filter((index) => index <= example.after);
            const target = before.length ? Math.max(...before) : Math.min(...writtenAt.keys());
            composed.splice(writtenAt.get(target)! + 1, 0, { kind: "example", text: example.text.trim() });
          }
          note("example", reason ? `dropped_${reason}` : "accepted");
        }
        // Every atom any item cites, each once, in first-use order.
        const byId = new Map(prompt.atoms.map((atom) => [atom.id, atom]));
        const used = unique(composed.flatMap((item) => item.kind === "example" ? [] : item.atom_ids)).map((id) => byId.get(id)!);
        // How many written sentences rest on verified sentences only, on book excerpts only, or on both (a count, never text).
        cited = { verified: 0, source: 0, both: 0 };
        for (const item of composed) {
          if (item.kind === "example" || item.text === undefined) continue;
          const kinds = new Set(item.atom_ids.map((id) => byId.get(id)?.role === "source"));
          if (kinds.size === 2) cited.both++; else if (kinds.has(true)) cited.source++; else cited.verified++;
        }
        return { status: "answer", mode: "composed", composed, atoms: used.map(publicAtom) };
      } catch { note("fallback", options.extractiveFallback === false ? "composition_failed" : "extractive"); }
    }
    if (options.extractiveFallback === false) { note("fallback", "disabled"); return { status: "insufficient", atoms: [] }; }
    try {
      const prompt = buildPrompt(question, atoms, 100_000, context, history);
      const value = await stage({ system: SYSTEM_PROMPT, message: prompt.message, schema: CHOICE_SCHEMA, stage: "select" }, budgets.select);
      const result = validateChoice(value, prompt.atoms);
      note("select", result.status);
      return result.status === "answer" ? { ...result, mode: "extractive" } : result;
    } catch { note("fallback", "insufficient"); return { status: "insufficient", atoms: [] }; }
  } finally {
    // One structured line per request; only fixed codes, names and elapsed times.
    (options.log || console.info)(JSON.stringify({ event: "ask", stages: events, ms: Date.now() - start, ...(options.logExtra || {}), ...(cited ? { cited } : {}) }));
  }
}
