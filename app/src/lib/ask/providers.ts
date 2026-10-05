// @ts-expect-error -- Node tests require explicit source extensions.
import { anthropicProvider, CHOICE_SCHEMA } from "./select.ts";
// @ts-expect-error -- Node tests require explicit source extensions.
import { lexicalScore } from "./normalize.ts";
import type { ChoiceProvider } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
// Gemini supports a subset of JSON Schema; validateChoice enforces uniqueness.
export const GEMINI_CHOICE_SCHEMA = {
  ...CHOICE_SCHEMA,
  properties: { ...CHOICE_SCHEMA.properties,
    atom_ids: { type: "array", items: { type: "string" }, maxItems: 4 } },
};

export function geminiProvider(apiKey: string, model = DEFAULT_GEMINI_MODEL): ChoiceProvider {
  return { async choose({ system, message, signal }) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal,
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: GEMINI_CHOICE_SCHEMA },
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
  return { async choose({ message, signal }) {
    signal.throwIfAborted();
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

export function providerFromEnv(env: Readonly<Record<string, string | undefined>>): ChoiceProvider | undefined {
  const name = env.HUDA_ASK_PROVIDER || (env.GEMINI_API_KEY ? "gemini" : env.ANTHROPIC_API_KEY ? "anthropic" : undefined);
  if (name === "gemini" && env.GEMINI_API_KEY) return geminiProvider(env.GEMINI_API_KEY, env.HUDA_ASK_MODEL || DEFAULT_GEMINI_MODEL);
  if (name === "anthropic" && env.ANTHROPIC_API_KEY) return anthropicProvider(env.ANTHROPIC_API_KEY, env.HUDA_ASK_MODEL || "claude-sonnet-5-5");
  if (name === "lexical" && env.NODE_ENV !== "production") return lexicalProvider();
  return undefined;
}
