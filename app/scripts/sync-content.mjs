import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
