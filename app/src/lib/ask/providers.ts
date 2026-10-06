import { randomUUID } from "node:crypto";
// @ts-expect-error -- Node tests require explicit source extensions.
import { anthropicProvider, CHOICE_SCHEMA, DEFAULT_ANTHROPIC_MODEL } from "./select.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { lexicalScore } from "./normalize.ts";
// @ts-expect-error -- Node requires source extensions.
import { fetchRetry, runStage } from "./runtime.ts";
// @ts-expect-error -- Node requires source extensions.
import { classifyFault, ProviderError } from "./fault.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { keyWithinShape, ownKeyFromHeaders } from "../own-key.ts";
import type { ChoiceProvider, SelectionRequest } from "./types";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
// Gemini supports a subset of JSON Schema; validateChoice enforces uniqueness.
export const GEMINI_CHOICE_SCHEMA = {
  ...CHOICE_SCHEMA,
  properties: { ...CHOICE_SCHEMA.properties,
    atom_ids: { type: "array", items: { type: "string" }, maxItems: 4 } },
};

/** Thrown for a fault of the model's service (HTTP 5xx, 429, no answer from the network): the one kind that the fallback model may retry. */
class GeminiServiceError extends Error {}
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
/** The model that answers when the configured one is down; an empty HUDA_ASK_GEMINI_FALLBACK_MODEL switches it off. */
export function geminiFallbackModel(env: Readonly<Record<string, string | undefined>>): string | undefined {
  return (env.HUDA_ASK_GEMINI_FALLBACK_MODEL ?? DEFAULT_GEMINI_FALLBACK_MODEL) || undefined;
}

export function geminiProvider(apiKey: string, model = DEFAULT_GEMINI_MODEL, fallbackModel?: string): ChoiceProvider {
  const call = async (name: string, attempts: number, { system, message, signal, schema }: SelectionRequest): Promise<unknown> => {
    const response = await fetchRetry(`${GEMINI_BASE_URL}/models/${encodeURIComponent(name)}:generateContent`, {
      method: "POST", signal,
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: schema ? withoutUniqueItems(schema) : GEMINI_CHOICE_SCHEMA },
      }),
    }, attempts).catch((error) => { throw signal.aborted ? error : new GeminiServiceError("Provider unreachable"); });
    if (!response.ok) throw response.status === 429 || response.status >= 500 ? new GeminiServiceError("Provider failed") : new Error("Provider failed");
    const data = await response.json();
    const candidates = data.candidates;
    if (!Array.isArray(candidates) || candidates.length !== 1 || candidates[0].finishReason !== "STOP") {
      throw new Error("Provider refused or returned incomplete output");
    }
    const parts = candidates[0].content?.parts;
    if (!Array.isArray(parts) || parts.some((part) => part.thought || typeof part.text !== "string")) throw new Error("Missing choice");
    return JSON.parse(parts.map((part) => part.text).join(""));
  };
  const fallback = fallbackModel && fallbackModel !== model ? fallbackModel : undefined;
  return { name: "gemini", async choose(request) {
    // With a fallback the configured model gets one attempt: the second model is the retry, inside the stage's own deadline.
    try { return await call(model, fallback ? 1 : 3, request); }
    catch (error) {
      if (!fallback || !(error instanceof GeminiServiceError) || request.signal.aborted) throw error;
      return call(fallback, 3, request);
    }
  } };
}

function promptData(message: string, name: string): unknown {
  const match = message.match(new RegExp(`(?:^|\\n)BEGIN_${name}_JSON\\n([^\\n]+)\\nEND_${name}_JSON(?:\\n|$)`));
  if (!match) throw new Error("Missing prompt data");
  return JSON.parse(match[1]);
}

/** Explicit opt-in only: a development aid, not a semantic safety classifier. */
export function lexicalProvider(): ChoiceProvider {
  return { name: "lexical", async choose({ message, signal, stage }) {
    signal.throwIfAborted();
    if (stage && stage !== "select") throw new Error("select_only");
    const { question } = promptData(message, "QUESTION") as { question: string };
    const sentences = promptData(message, "SENTENCES") as { id: string; sentence: string; role: string }[];
    const ranked = sentences.map((sentence, i) => ({ ...sentence, i, score: lexicalScore(question, sentence.sentence) }))
      .filter((sentence) => sentence.score > 1)
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const selected = ranked.slice(0, 3);
    if (!selected.some((sentence) => sentence.role === "claim")) return { status: "insufficient", atom_ids: [] };
    return { status: "answer", atom_ids: selected.map((sentence) => sentence.id) };
  } };
}

/** Gemini and OpenAI's constrained schema dialects do not support uniqueItems.
 * Runtime validators enforce uniqueness for every stage. */
function withoutUniqueItems(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUniqueItems);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "uniqueItems").map(([key, item]) => [key, withoutUniqueItems(item)]));
  return value;
}
const PROCESS_SESSION = randomUUID();
export const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";
export function openaiCompatibleProvider({ baseUrl, apiKey, model }: { baseUrl: string; apiKey: string; model: string }): ChoiceProvider {
  return { name: "openai-compatible", async choose({ system, message, signal, schema }) {
    const response = await fetchRetry(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "user-agent": "huda-ask/1.0",
        "x-opencode-session": PROCESS_SESSION },
      body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: message }],
        response_format: { type: "json_schema", json_schema: { name: "ask_response", strict: true, schema: withoutUniqueItems(schema || CHOICE_SCHEMA) } } }),
    });
    if (!response.ok) throw new Error("provider_http");
    const data = await response.json();
    if (!Array.isArray(data.choices) || data.choices.length !== 1 || data.choices[0].finish_reason !== "stop"
      || data.choices[0].message?.refusal || typeof data.choices[0].message?.content !== "string") throw new Error("provider_output");
    return JSON.parse(data.choices[0].message.content);
  } };
}
export const OPENAI_BASE_URL = "https://api.openai.com/v1";
/** Groq serves open-weight models through the chat-completions dialect; listed only when named in HUDA_ASK_PROVIDER. */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/** Any endpoint that speaks the OpenAI Responses API; the session header is only for OpenCode Go. */
export function responsesProvider({ name, baseUrl, apiKey, model, sessionHeader, effort }: { name: string; baseUrl: string; apiKey: string; model: string; sessionHeader: boolean; effort?: string }): ChoiceProvider {
  return { name, async choose({ system, message, signal, schema, deadline }) {
    const outputSchema = withoutUniqueItems(schema || CHOICE_SCHEMA);
    const send = (structured: boolean) => fetchRetry(`${baseUrl}/responses`, {
      method: "POST", signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "user-agent": "huda-ask/1.0", ...(sessionHeader ? { "x-opencode-session": PROCESS_SESSION } : {}) },
      body: JSON.stringify({ model, input: message, ...(effort ? { reasoning: { effort } } : {}),
        instructions: structured ? system : `${system}\nReturn ONLY valid JSON matching this schema, with no markdown fences:\n${JSON.stringify(outputSchema)}`,
        ...(structured ? { text: { format: { type: "json_schema", name: "ask_response", strict: true, schema: outputSchema } } } : {}),
      }),
    }, 3, deadline);
    let response = await send(true);
    if ([400, 422].includes(response.status)) {
      const error = await response.text();
      // Retry without structured output only for a schema/format rejection.
      // Neither this diagnostic nor any upstream response is ever logged.
      if (!/schema|text[. _]format|response[ _]format/i.test(error)) throw new ProviderError(response.status, classifyFault(response.status, error));
      response = await send(false);
    }
    // Only the fixed fault of the refusal leaves here, never the provider's own words.
    if (!response.ok) throw new ProviderError(response.status, classifyFault(response.status, await response.text().catch(() => "")));
    const data = await response.json();
    if (data.status !== "completed" || data.error || data.incomplete_details || !Array.isArray(data.output)) throw new Error("provider_output");
    const parts = data.output.flatMap((item: { type?: string; content?: unknown[] }) => item.type === "message" && Array.isArray(item.content) ? item.content : []);
    if (!parts.length || parts.some((part: { type?: string; text?: unknown }) => part.type !== "output_text" || typeof part.text !== "string")) throw new Error("provider_output");
    return JSON.parse(parts.map((part: { text: string }) => part.text).join(""));
  } };
}
/** OpenCode Go's Luna model uses Responses, not chat completions. */
export function opencodeGoProvider(apiKey: string, model = "gpt-6-luna", effort?: string): ChoiceProvider {
  return responsesProvider({ name: "opencode-go", baseUrl: OPENCODE_GO_BASE_URL, apiKey, model, sessionHeader: true, effort });
}
/** Direct OpenAI, the fallback when OpenCode Go fails. */
export function openaiProvider(apiKey: string, model = "gpt-6-luna", effort?: string): ChoiceProvider {
  return responsesProvider({ name: "openai", baseUrl: OPENAI_BASE_URL, apiKey, model, sessionHeader: false, effort });
}
/** The model a judge's OpenAI key calls: the one the project's own chain uses, and the one every OpenAI key tried so far could reach (a key with no credit reaches only this one). */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
export const DEFAULT_OPENAI_FALLBACK_MODEL = "gpt-5-mini";
/** The model that answers when the configured one is not open to the judge's account; an empty HUDA_ASK_OPENAI_FALLBACK_MODEL switches it off. */
export function openaiFallbackModel(env: Readonly<Record<string, string | undefined>>): string | undefined {
  return (env.HUDA_ASK_OPENAI_FALLBACK_MODEL ?? DEFAULT_OPENAI_FALLBACK_MODEL) || undefined;
}
/** The backup is tried only when the provider says the model is not available to this key: a rate limit or a missing credit would be the same on any model. */
function withModelFallback(primary: ChoiceProvider, backup?: ChoiceProvider): ChoiceProvider {
  if (!backup) return primary;
  return { name: primary.name, async choose(request) {
    try { return await primary.choose(request); }
    catch (error) {
      if (!(error instanceof ProviderError) || error.fault !== "model_unavailable" || request.signal.aborted) throw error;
      return backup.choose(request);
    }
  } };
}
/** The supplied secret belongs only to the returned request-scoped provider. Only the Ask providers a judge may enter are built here. */
export function providersFromKey(provider: string, key: string, env: Readonly<Record<string, string | undefined>>): ChoiceProvider[] {
  if (!keyWithinShape(key)) return [];
  const effort = env.HUDA_ASK_EFFORT === "default" ? undefined : env.HUDA_ASK_EFFORT || "low";
  if (provider === "openai") {
    // HUDA_ASK_MODEL names a model of the project's own chain (it may belong to another provider); a judge's OpenAI key has its own settings.
    const fallback = openaiFallbackModel(env);
    return [withModelFallback(openaiProvider(key, env.HUDA_ASK_OPENAI_MODEL || DEFAULT_OPENAI_MODEL, effort),
      fallback ? openaiProvider(key, fallback, effort) : undefined)];
  }
  // The judge's Google key calls the same model as the project's, with the same fallback model; HUDA_ASK_MODEL names the OpenAI model, so Google has its own override.
  if (provider === "gemini") return [geminiProvider(key, env.HUDA_ASK_GEMINI_MODEL || DEFAULT_GEMINI_MODEL, geminiFallbackModel(env))];
  // Likewise for a judge's Anthropic key: its model has its own setting, never HUDA_ASK_MODEL, and the request carries no effort or thinking parameter.
  if (provider === "anthropic") return [anthropicProvider(key, env.HUDA_ASK_ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL)];
  return [];
}

/** Any own-key header opts out of the project's chain, including malformed or incomplete pairs. */
export function providersForRequest(headers: Headers, env: Readonly<Record<string, string | undefined>>) {
  const { present, own } = ownKeyFromHeaders(headers, "ask");
  return {
    ownKey: present, provider: own?.provider,
    providers: present ? own ? providersFromKey(own.provider, own.key, env) : [] : providersFromEnv(env),
  };
}
export function providersFromEnv(env: Readonly<Record<string, string | undefined>>): ChoiceProvider[] {
  const names = env.HUDA_ASK_PROVIDER?.split(",").map((name) => name.trim()) || [
    ...(env.OPENCODE_GO_API_KEY ? ["opencode-go"] : []), ...(env.OPENAI_API_KEY ? ["openai"] : []), ...(env.GEMINI_API_KEY ? ["gemini"] : []), ...(env.ANTHROPIC_API_KEY ? ["anthropic"] : []),
  ];
  // Measured live on the writing stage: the model's default reasoning level takes about 10 s, "low" about 3.5 s, with the same answer quality. HUDA_ASK_EFFORT=default leaves the level to the model.
  const effort = env.HUDA_ASK_EFFORT === "default" ? undefined : env.HUDA_ASK_EFFORT || "low";
  return [...new Set(names)].flatMap((name) => {
    if (name === "opencode-go" && env.OPENCODE_GO_API_KEY) return [opencodeGoProvider(env.OPENCODE_GO_API_KEY, env.HUDA_ASK_MODEL || "gpt-6-luna", effort)];
    if (name === "openai" && env.OPENAI_API_KEY) return [openaiProvider(env.OPENAI_API_KEY, env.HUDA_ASK_MODEL || "gpt-6-luna", effort)];
    if (name === "groq" && env.GROQ_API_KEY) return [{ ...openaiCompatibleProvider({ baseUrl: GROQ_BASE_URL, apiKey: env.GROQ_API_KEY, model: env.HUDA_ASK_GROQ_MODEL || "openai/gpt-oss-120b" }), name: "groq" }];
    if (name === "gemini" && env.GEMINI_API_KEY) return [geminiProvider(env.GEMINI_API_KEY, env.HUDA_ASK_MODEL || DEFAULT_GEMINI_MODEL, geminiFallbackModel(env))];
    if (name === "anthropic" && env.ANTHROPIC_API_KEY) return [anthropicProvider(env.ANTHROPIC_API_KEY, env.HUDA_ASK_ANTHROPIC_MODEL || env.HUDA_ASK_MODEL || DEFAULT_ANTHROPIC_MODEL)];
    if (name === "lexical" && env.NODE_ENV !== "production") return [lexicalProvider()];
    return [];
  });
}
/** Compatibility for step-1 callers; each stage retries across the same chain. */
export function providerFromEnv(env: Readonly<Record<string, string | undefined>>): ChoiceProvider | undefined {
  const providers = providersFromEnv(env);
  return providers.length === 1 ? providers[0] : providers.length ? { name: "chain", choose: (request) => runStage(request, providers, 20_000, () => {}, request.signal) } : undefined;
}
