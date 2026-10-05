import { randomUUID } from "node:crypto";
// @ts-expect-error -- Node tests require explicit source extensions.
import { anthropicProvider, CHOICE_SCHEMA } from "./select.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { lexicalScore } from "./normalize.ts";
// @ts-expect-error -- Node requires source extensions.
import { fetchRetry, runStage } from "./runtime.ts";
import type { ChoiceProvider } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
// Gemini supports a subset of JSON Schema; validateChoice enforces uniqueness.
export const GEMINI_CHOICE_SCHEMA = {
  ...CHOICE_SCHEMA,
  properties: { ...CHOICE_SCHEMA.properties,
    atom_ids: { type: "array", items: { type: "string" }, maxItems: 4 } },
};

export function geminiProvider(apiKey: string, model = DEFAULT_GEMINI_MODEL): ChoiceProvider {
  return { name: "gemini", async choose({ system, message, signal, schema }) {
    const response = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal,
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: schema ? withoutUniqueItems(schema) : GEMINI_CHOICE_SCHEMA },
      }),
    });
    if (!response.ok) throw new Error("Provider failed");
    const data = await response.json();
    const candidates = data.candidates;
    if (!Array.isArray(candidates) || candidates.length !== 1 || candidates[0].finishReason !== "STOP") {
      throw new Error("Provider refused or returned incomplete output");
    }
    const parts = candidates[0].content?.parts;
    if (!Array.isArray(parts) || parts.some((part) => part.thought || typeof part.text !== "string")) throw new Error("Missing choice");
    return JSON.parse(parts.map((part) => part.text).join(""));
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
export function responsesProvider({ name, baseUrl, apiKey, model, sessionHeader }: { name: string; baseUrl: string; apiKey: string; model: string; sessionHeader: boolean }): ChoiceProvider {
  return { name, async choose({ system, message, signal, schema }) {
    const outputSchema = withoutUniqueItems(schema || CHOICE_SCHEMA);
    const send = (structured: boolean) => fetchRetry(`${baseUrl}/responses`, {
      method: "POST", signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "user-agent": "huda-ask/1.0", ...(sessionHeader ? { "x-opencode-session": PROCESS_SESSION } : {}) },
      body: JSON.stringify({ model, input: message,
        instructions: structured ? system : `${system}\nReturn ONLY valid JSON matching this schema, with no markdown fences:\n${JSON.stringify(outputSchema)}`,
        ...(structured ? { text: { format: { type: "json_schema", name: "ask_response", strict: true, schema: outputSchema } } } : {}),
      }),
    });
    let response = await send(true);
    if ([400, 422].includes(response.status)) {
      const error = await response.text();
      // Retry without structured output only for a schema/format rejection.
      // Neither this diagnostic nor any upstream response is ever logged.
      if (!/schema|text[. _]format|response[ _]format/i.test(error)) throw new Error("provider_http");
      response = await send(false);
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data = await response.json();
    if (data.status !== "completed" || data.error || data.incomplete_details || !Array.isArray(data.output)) throw new Error("provider_output");
    const parts = data.output.flatMap((item: { type?: string; content?: unknown[] }) => item.type === "message" && Array.isArray(item.content) ? item.content : []);
    if (!parts.length || parts.some((part: { type?: string; text?: unknown }) => part.type !== "output_text" || typeof part.text !== "string")) throw new Error("provider_output");
    return JSON.parse(parts.map((part: { text: string }) => part.text).join(""));
  } };
}
/** OpenCode Go's Luna model uses Responses, not chat completions. */
export function opencodeGoProvider(apiKey: string, model = "gpt-6-luna"): ChoiceProvider {
  return responsesProvider({ name: "opencode-go", baseUrl: OPENCODE_GO_BASE_URL, apiKey, model, sessionHeader: true });
}
/** Direct OpenAI, the fallback when OpenCode Go fails. */
export function openaiProvider(apiKey: string, model = "gpt-6-luna"): ChoiceProvider {
  return responsesProvider({ name: "openai", baseUrl: OPENAI_BASE_URL, apiKey, model, sessionHeader: false });
}
export function providersFromEnv(env: Readonly<Record<string, string | undefined>>): ChoiceProvider[] {
  const names = env.HUDA_ASK_PROVIDER?.split(",").map((name) => name.trim()) || [
    ...(env.OPENCODE_GO_API_KEY ? ["opencode-go"] : []), ...(env.OPENAI_API_KEY ? ["openai"] : []), ...(env.GEMINI_API_KEY ? ["gemini"] : []), ...(env.ANTHROPIC_API_KEY ? ["anthropic"] : []),
  ];
  return [...new Set(names)].flatMap((name) => {
    if (name === "opencode-go" && env.OPENCODE_GO_API_KEY) return [opencodeGoProvider(env.OPENCODE_GO_API_KEY, env.HUDA_ASK_MODEL || "gpt-6-luna")];
    if (name === "openai" && env.OPENAI_API_KEY) return [openaiProvider(env.OPENAI_API_KEY, env.HUDA_ASK_MODEL || "gpt-6-luna")];
    if (name === "groq" && env.GROQ_API_KEY) return [{ ...openaiCompatibleProvider({ baseUrl: GROQ_BASE_URL, apiKey: env.GROQ_API_KEY, model: env.HUDA_ASK_GROQ_MODEL || "openai/gpt-oss-120b" }), name: "groq" }];
    if (name === "gemini" && env.GEMINI_API_KEY) return [geminiProvider(env.GEMINI_API_KEY, env.HUDA_ASK_MODEL || DEFAULT_GEMINI_MODEL)];
    if (name === "anthropic" && env.ANTHROPIC_API_KEY) return [anthropicProvider(env.ANTHROPIC_API_KEY, env.HUDA_ASK_MODEL || "claude-sonnet-5-5")];
    if (name === "lexical" && env.NODE_ENV !== "production") return [lexicalProvider()];
    return [];
  });
}
/** Compatibility for step-1 callers; each stage retries across the same chain. */
export function providerFromEnv(env: Readonly<Record<string, string | undefined>>): ChoiceProvider | undefined {
  const providers = providersFromEnv(env);
  return providers.length === 1 ? providers[0] : providers.length ? { name: "chain", choose: (request) => runStage(request, providers, 20_000, () => {}, request.signal) } : undefined;
}
