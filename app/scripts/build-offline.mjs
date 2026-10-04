import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(app, "out");
if (process.env.HUDA_ASK === "1") {
  console.log("Offline worker skipped: HUDA_ASK enables a server build, not a static export.");
  process.exit(0);
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }));
  return results.flat();
}
const files = (await walk(out)).filter((file) => !file.endsWith(".map") && path.relative(out, file) !== "sw.js").sort();
const hash = createHash("sha256");
const urls = [];
for (const file of files) {
  const relative = path.relative(out, file).split(path.sep).join("/");
  hash.update(relative).update(await readFile(file));
  const url = "/" + relative;
  urls.push(url.endsWith("/index.html") ? url.slice(0, -10) : url);
}
const template = await readFile(path.join(app, "public/sw.js"), "utf8");
const worker = template
  .replace('"huda-static-development"', JSON.stringify(`huda-static-${hash.digest("hex").slice(0, 16)}`))
  .replace('const PRECACHE_URLS = ["/"];', `const PRECACHE_URLS = ${JSON.stringify([...new Set(urls)])};`);
await writeFile(path.join(out, "sw.js"), worker);
console.log(`Offline worker prepared for ${urls.length} static files.`);
