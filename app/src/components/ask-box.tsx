"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { Surah, Ui, SourceRecord } from "@/lib/types";
import type { AskResponse, AskUi } from "@/lib/ask/types";
import { ContentBlock } from "./reader";
import { SourcePanel } from "./source-panel";
import "@/app/ask.css";

export function AskBox({ surah, ui: baseUi }: { surah: Surah; ui: Ui }) {
  const ui = baseUi as AskUi;
  const id = useId();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [selected, setSelected] = useState<SourceRecord[] | null>(null);
  const active = useRef<AbortController | null>(null);
  const ayahs = useMemo(() => new Map(surah.ayahs.map((ayah) => [ayah.key, ayah])), [surah.ayahs]);
  const closePanel = useCallback(() => setSelected(null), []);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || [...question.trim()].length < 3 || [...question.trim()].length > 300) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setResult(null); setSelected(null);
    try {
      const response = await fetch("/api/ask/", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surah: surah.surah.no, question: question.trim() }) });
      setResult(response.ok ? await response.json() as AskResponse : { status: "insufficient", atoms: [] });
    } catch {
      if (!controller.signal.aborted) setResult({ status: "insufficient", atoms: [] });
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const fixed = result?.status === "unavailable" ? ui.ask.unavailable
    : result?.status === "fatwa" ? ui.phrases.fatwa
    : result?.status === "out_of_scope" ? ui.phrases.out_of_scope
    : result?.status === "not_arabic" ? ui.phrases.arabic_only : ui.phrases.insufficient_sources;
  return <section className="ask-box" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{ui.ask.title}</h2>
    <p id={`${id}-note`} className="ask-note">{ui.ask.note}</p>
    <form onSubmit={submit} aria-busy={loading}>
      <label htmlFor={`${id}-question`}>{ui.ask.placeholder}</label>
      <textarea id={`${id}-question`} name="question" value={question} onChange={(event) => setQuestion(event.target.value)}
        placeholder={ui.ask.placeholder} aria-describedby={`${id}-note`} minLength={3} maxLength={300} required rows={3} />
      <button type="submit" disabled={loading || [...question.trim()].length < 3}>{ui.ask.submit}</button>
    </form>
    <div className="ask-result" aria-live="polite" aria-atomic="true" aria-busy={loading}>
      {loading ? <p>{ui.ask.loading}</p> : result ? result.status === "answer" ? <>
        <h3>{ui.ask.answer_title}</h3>
        {result.atoms.map((atom) => <ContentBlock key={atom.id} block={{ type: "paragraph", role: atom.role, segments: atom.segments }}
          ayahs={ayahs} records={surah.records} ui={ui} onOpen={setSelected} />)}
      </> : <>
        <p>{fixed}</p>
        {result.status === "fatwa" || result.status === "out_of_scope" ? <a href={ui.links.fatwa.url}>{ui.links.fatwa.label}</a> : null}
      </> : null}
    </div>
    {selected ? <SourcePanel records={selected} ui={ui} onClose={closePanel} /> : null}
  </section>;
}
