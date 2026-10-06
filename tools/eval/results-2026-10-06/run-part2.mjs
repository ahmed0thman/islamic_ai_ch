// usage (B): node --env-file=<path-to-your-own-env-file> run-part2.mjs B out.jsonl
//       (A): node run-part2.mjs A out.jsonl
import { readFile, appendFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
const [sys, out] = process.argv.slice(2);
const qs = JSON.parse(await readFile(new URL(process.env.QFILE || "./part2-questions.json", import.meta.url)));
const idx = JSON.parse(await readFile("../../../app/src/content/index.json", "utf8")).surahs;
const nameOf = (n) => idx.find((s) => s.no === n)?.name.replace(/[ً-ْٰ]/g, "");
const MODEL = "gemini-3.5-flash-lite";
const INSTRUCTION = (name) => `أنت مساعد يشرح القرآن لقارئ عام غير متخصص. أجب عن السؤال الآتي عن سورة ${name} في جمل واضحة قصيرة. اكتب مع كل جملة اسم المصدر الذي تستند إليه (كتاب أو عالم)، واقتباسًا حرفيًّا من ذلك المصدر يدعم الجملة. إن لم تجد ما تجيب به فاجعل declined تساوي true واترك الجمل فارغة.`;
const SCHEMA = { type: "OBJECT", properties: { declined: { type: "BOOLEAN" }, sentences: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" }, source: { type: "STRING" }, quote: { type: "STRING" } }, required: ["text", "source", "quote"] } } }, required: ["declined", "sentences"] };
for (const [i, q] of qs.entries()) {
  if (i) await sleep(sys === "A" ? 5500 : 6000);
  let rec;
  for (let attempt = 0; attempt < 4; attempt++) {
    const t = Date.now();
    try {
      let r, body;
      if (sys === "A") {
        r = await fetch("http://localhost:3244/api/ask/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ surah: q.surah, question: q.question }), signal: AbortSignal.timeout(120000) });
        body = await r.json().catch(() => ({ bad_json: true }));
      } else {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: INSTRUCTION(nameOf(q.surah)) }] }, contents: [{ role: "user", parts: [{ text: q.question }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA } }), signal: AbortSignal.timeout(120000) });
        const data = await r.json().catch(() => ({}));
        const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        let parsed; try { parsed = JSON.parse(txt); } catch { parsed = undefined; }
        body = { parsed, finish: data?.candidates?.[0]?.finishReason, err: r.ok ? undefined : (data?.error?.status ?? "error") };
      }
      rec = { sys, id: q.id, surah: q.surah, question: q.question, http: r.status, ms: Date.now() - t, attempt, body };
    } catch (e) { rec = { sys, id: q.id, surah: q.surah, question: q.question, http: 0, ms: Date.now() - t, attempt, error: e.name }; }
    const st = rec.body?.status;
    if (rec.http === 429 || rec.http === 0 || rec.http >= 500 || st === "unavailable") { rec.provider_refused = true; if (attempt < 3) { await sleep(20000 * (attempt + 1)); continue; } }
    break;
  }
  await appendFile(out, JSON.stringify(rec) + "\n");
  console.log(sys, q.surah, rec.http, rec.body?.status ?? (rec.body?.parsed ? `declined=${rec.body.parsed.declined} n=${rec.body.parsed.sentences?.length}` : "?"), rec.ms + "ms", rec.provider_refused ? "REFUSED" : "");
}
