import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildMushafIndex } from "./mushaf-index.mjs";
// Keep this script runnable on the app's Node 20 minimum without TS loading.
// The verifier test compares every generated ayah against normalize.ts.
function normalize(text) {
  return text.replace(/[\u0622\u0623\u0625\u0671\u0621\u0624\u0626]/gu, "\u0627").normalize("NFD")
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
    .replace(/[\u0622\u0623\u0625\u0671\u0621\u0624\u0626]/gu, "\u0627")
    .replace(/\u0649/gu, "\u064a")
    .replace(/\u0629/gu, "\u0647")
    .toLowerCase();
}

const app = fileURLToPath(new URL("../", import.meta.url));
const source = path.resolve(app, "../content");
const target = path.join(app, "src/content");
const names = (await readdir(path.join(source, "export"))).filter((name) => name.endsWith(".json"));
if (!names.includes("index.json")) throw new Error("content/export/index.json is missing");
// Read and parse everything before changing the generated directory.
const files = await Promise.all([
  ["ui.ar.json", path.join(source, "ui.ar.json")],
  ...names.map((name) => [name, path.join(source, "export", name)]),
].map(async ([name, file]) => {
  const bytes = await readFile(file);
  JSON.parse(bytes.toString("utf8"));
  return { name, bytes };
}));
const quran = JSON.parse(await readFile(path.resolve(app, "../tools/data/qurancomplex/hafsData_v2-0.json"), "utf8"));
if (quran.length !== 6236 || quran.some((ayah) => typeof ayah.aya_text_emlaey !== "string")) throw new Error("Invalid Quran dataset");
files.push({ name: "quran-plain.json", bytes: Buffer.from(JSON.stringify(quran.map((ayah) => normalize(ayah.aya_text_emlaey))) + "\n") });
const simple = JSON.parse(await readFile(path.resolve(app, "../tools/data/quran-simple-clean.json"), "utf8"));
files.push({ name: "mushaf-index.json", bytes: Buffer.from(JSON.stringify(buildMushafIndex(quran, simple)) + "\n") });
files.push({ name: "quran-uthmani.json", bytes: Buffer.from(JSON.stringify(quran.map((ayah) => ayah.aya_text)) + "\n") });
await mkdir(target, { recursive: true });
for (const file of files) await writeFile(path.join(target, file.name), file.bytes);
// Only remove stale generated JSON files inside the app.
const keep = new Set(files.map((file) => file.name));
for (const name of await readdir(target)) {
  if (name.endsWith(".json") && !keep.has(name)) await rm(path.join(target, name));
}
// All manifest text is copied from the UI dictionary, never authored here.
const ui = JSON.parse(files.find((file) => file.name === "ui.ar.json").bytes.toString("utf8"));
await writeFile(path.join(app, "public/manifest.webmanifest"), JSON.stringify({
  id: "/", name: ui.app_name, short_name: ui.app_name, description: ui.tagline,
  lang: "ar", dir: "rtl", start_url: "/", scope: "/", display: "standalone",
  background_color: "#f8f5ee", theme_color: "#234b40",
  icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
}, null, 2) + "\n");
console.log(`Synced ${files.length} content files.`);
