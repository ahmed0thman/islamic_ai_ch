// @ts-expect-error -- Node requires the source extension; Next resolves TypeScript itself.
import { EMBED_DIMENSIONS, EMBED_MODEL_NAME } from "./scope.ts";

/**
 * Local sentence embeddings (multilingual-e5-small, 8-bit ONNX, 384 dimensions) inside this Node process.
 * Input is the NORMALISED text (`text_norm`) with the E5 prefixes `query: ` / `passage: `; evaluation decides later whether raw text does better.
 * `HUDA_EMBED=local` turns it on (default `off`); `HUDA_EMBED_MODEL_DIR` is the folder that holds `Xenova/multilingual-e5-small/`. No network is ever used.
 */
const QUERY_TIMEOUT_MS = 1500;
/** The model reads at most 512 tokens; longer text is embedded on its head. Cutting the characters first keeps tokenising cheap. */
export const EMBED_MAX_CHARS = 3000;

interface Tensor { tolist(): number[][]; dispose?: () => void }
type Extractor = (texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<Tensor>;
export interface EmbedInfo { loaded: boolean; ms: number; rss_mb: number }

const info: EmbedInfo = { loaded: false, ms: 0, rss_mb: 0 };
let extractor: Promise<Extractor | null> | undefined;
let chain: Promise<unknown> = Promise.resolve();
let failureLogged = false;

const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);
export const embedEnabled = () => process.env.HUDA_EMBED === "local";
/** Numbers only: when the model loaded, how long it took, and the process memory right after. */
export const embedInfo = (): EmbedInfo => ({ ...info, rss_mb: info.loaded ? rssMb() : 0 });
/** Memory of the process right after the model finished loading (before any text was embedded). */
export const embedLoadRssMb = () => info.rss_mb;

async function load(): Promise<Extractor | null> {
  const started = performance.now();
  try {
    const directory = process.env.HUDA_EMBED_MODEL_DIR;
    if (!directory) throw new Error("no model directory");
    const transformers = await import("@huggingface/transformers");
    transformers.env.allowRemoteModels = false;
    transformers.env.allowLocalModels = true;
    transformers.env.localModelPath = directory.endsWith("/") ? directory : `${directory}/`;
    const create = transformers.pipeline as unknown as (task: string, model: string, options: object) => Promise<Extractor>;
    const loaded = await create("feature-extraction", EMBED_MODEL_NAME, { dtype: "q8" });
    info.loaded = true;
    info.ms = Math.round(performance.now() - started);
    info.rss_mb = rssMb();
    console.info(JSON.stringify({ event: "embed", loaded: true, ms: info.ms, rss_mb: info.rss_mb }));
    return loaded;
  } catch {
    if (!failureLogged) { failureLogged = true; console.info(JSON.stringify({ event: "embed", loaded: false })); }
    return null;
  }
}

/** Starts loading the model without waiting; the first question then does not pay for it. */
export function warmEmbed(): Promise<boolean> {
  if (!embedEnabled()) return Promise.resolve(false);
  extractor ??= load();
  return extractor.then((model) => model !== null);
}

async function run(prefix: string, texts: string[]): Promise<number[][] | null> {
  if (!embedEnabled()) return null;
  extractor ??= load();
  const model = await extractor;
  if (!model) return null;
  const job = chain.then(async () => {
    const tensor = await model(texts.map((text) => prefix + text.slice(0, EMBED_MAX_CHARS)), { pooling: "mean", normalize: true });
    const rows = tensor.tolist();
    tensor.dispose?.();
    return rows;
  });
  chain = job.catch(() => undefined);
  const rows = await job;
  if (rows.length !== texts.length || rows.some((row) => row.length !== EMBED_DIMENSIONS)) throw new Error("unexpected embedding shape");
  return rows;
}

/** One vector for a question, or `null` when embedding is off, fails or takes longer than 1.5 seconds. Never throws. */
export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), QUERY_TIMEOUT_MS); });
    try { return (await Promise.race([run("query: ", [text]), timeout]))?.[0] ?? null; }
    finally { clearTimeout(timer); }
  } catch { return null; }
}

/** Vectors for passages or atoms (ingest only). Throws when embedding is off or fails, so an ingest never stores a silent hole. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const rows = await run("passage: ", texts);
  if (!rows) throw new Error("embedding is off or the model could not be loaded (set HUDA_EMBED=local and HUDA_EMBED_MODEL_DIR)");
  return rows;
}

/** pgvector text form of a vector. */
export const vectorLiteral = (vector: number[]): string => `[${vector.join(",")}]`;
