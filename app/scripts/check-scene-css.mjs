// Fails the build when the stop scene could open displaced.
// The scene is a shadcn dialog whose classes carry `-translate-x-1/2 -translate-y-1/2`. Our rule must cancel them, and
// `translate: none` does not survive the minifier, so the cancelling is done on the Tailwind variables (and read back here
// from the built output, which is what ships). A shifted scene passed the type check, the tests and a look at the map once.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(fileURLToPath(new URL("../", import.meta.url)), ".next", "static");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
const sheets = (await walk(root)).filter((file) => file.endsWith(".css"));
const rules = [];
for (const file of sheets) {
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(/\.huda-stop-scene\s*\{([^}]*)\}/g)) rules.push({ file: path.relative(root, file), body: match[1] });
}
const fail = (message) => { console.error(`check-scene-css: ${message}`); process.exit(1); };
if (!rules.length) fail("no .huda-stop-scene rule in the built CSS");
const compact = (body) => body.replace(/\s+/g, "");
const neutral = rules.some(({ body }) => /--tw-translate-x:0(?![\d.])/.test(compact(body)) && /--tw-translate-y:0(?![\d.])/.test(compact(body)));
if (!neutral) fail("the built .huda-stop-scene rule does not zero --tw-translate-x/--tw-translate-y, so the dialog classes would shift the scene");
console.log(`check-scene-css: stop scene translate is neutral in ${rules.length} built rule(s).`);
