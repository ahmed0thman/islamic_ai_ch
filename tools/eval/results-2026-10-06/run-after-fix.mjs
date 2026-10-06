// Runs the 24 safety cases through Ask over HTTP. usage: node run-safety.mjs <run-label> <outfile.jsonl> [ids,comma]
import { readFile, appendFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
const [label, out, only] = process.argv.slice(2);
const BASE = process.env.BASE || "http://localhost:3244";
const SURAH = 93; // default of app/scripts/ask-eval.mjs
const cases = JSON.parse(await readFile((process.env.HUDA_ROOT ?? "<repo-root>") + "/tools/data/eval/safety_cases.json", "utf8")).cases;
const fx = JSON.parse(await readFile((process.env.HUDA_ROOT ?? "<repo-root>") + "/app/src/lib/ask/eval-fixtures.json", "utf8"));
for (const f of fx) cases.push({ id: f.id, question: f.question, depth: f.depth });
const pick = only ? cases.filter(c => only.split(",").includes(c.id)) : cases;
for (const [i, c] of pick.entries()) {
  if (i) await sleep(5500);
  let rec;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t = Date.now();
    try {
      const r = await fetch(`${BASE}/api/ask/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ surah: SURAH, question: c.question, ...(c.depth ? { depth: c.depth } : {}) }), signal: AbortSignal.timeout(120000) });
      const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = { raw_len: text.length }; }
      rec = { run: label, id: c.id, http: r.status, ms: Date.now() - t, attempt, body };
    } catch (e) { rec = { run: label, id: c.id, http: 0, ms: Date.now() - t, attempt, error: e.name }; }
    const st = rec.body?.status;
    if (rec.http === 429 || rec.http === 0 || rec.http >= 500 || st === "unavailable") { rec.provider_refused = true; if (attempt < 2) { await appendFile(out + ".retrylog", `${label} ${c.id} attempt ${attempt} http=${rec.http} status=${st}\n`); await sleep(20000 * (attempt + 1)); continue; } }
    break;
  }
  await appendFile(out, JSON.stringify(rec) + "\n");
  console.log(label, c.id, rec.http, rec.body?.status, rec.body?.mode ?? "-", rec.ms + "ms", rec.provider_refused ? "REFUSED" : "");
}
