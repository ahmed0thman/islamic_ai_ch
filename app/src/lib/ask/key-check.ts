// @ts-expect-error -- Node tests require explicit source extensions.
import { OWN_KEY_PURPOSES, type OwnKeyProvider } from "../own-key.ts";
// @ts-expect-error -- Node requires source extensions.
import { GEMINI_BASE_URL, GROQ_BASE_URL, providersFromKey } from "./providers.ts";
// @ts-expect-error -- Node requires source extensions.
import { runStage } from "./runtime.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { ANTHROPIC_BASE_URL, ANTHROPIC_VERSION, CHOICE_SCHEMA } from "./select.ts";

export type KeyCheck = "ok" | "rejected" | "timeout";
export const KEY_CHECK_MS = 8_000;

/** One cheap authenticated read: a model listing. The upstream answer is never read beyond its status. */
async function listModels(url: string, headers: Record<string, string>, ms: number, signal: AbortSignal): Promise<KeyCheck> {
  const deadline = AbortSignal.timeout(ms);
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.any([signal, deadline]), cache: "no-store" });
    await response.body?.cancel();
    return response.ok ? "ok" : "rejected";
  } catch { return deadline.aborted ? "timeout" : "rejected"; }
}

/** Checks a judge's key at its own provider, by what the key is for. Nothing here keeps or reports the key. */
export async function checkOwnKey(provider: OwnKeyProvider, key: string, env: Readonly<Record<string, string | undefined>>, signal: AbortSignal, ms = KEY_CHECK_MS): Promise<KeyCheck> {
  if (OWN_KEY_PURPOSES[provider] === "transcribe") return listModels(`${GROQ_BASE_URL}/models`, { authorization: `Bearer ${key}` }, ms, signal);
  if (provider === "gemini") return listModels(`${GEMINI_BASE_URL}/models?pageSize=1`, { "x-goog-api-key": key }, ms, signal);
  if (provider === "anthropic") return listModels(`${ANTHROPIC_BASE_URL}/models`, { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION }, ms, signal);
  const providers = providersFromKey(provider, key, env);
  if (!providers.length) return "rejected";
  let outcome: KeyCheck = "rejected";
  try {
    const value = await runStage({
      system: 'Return only {"status":"insufficient","atom_ids":[]}.', message: "Check access.", schema: CHOICE_SCHEMA, stage: "select",
    }, providers, ms, (event: { outcome: string }) => { if (event.outcome === "timeout") outcome = "timeout"; }, signal);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "rejected";
    const choice = value as Record<string, unknown>;
    return Object.keys(choice).length === 2 && choice.status === "insufficient" && Array.isArray(choice.atom_ids) && choice.atom_ids.length === 0 ? "ok" : "rejected";
  } catch { return outcome; }
}
